import cloudinary from '../config/cloudinary.js';
import Query from '../models/Query.js';
import Location from '../models/Location.js';
import User from '../models/User.js';
import { notifyCompany, notifySuperadmin, createNotification } from '../utils/notifications.js';
import { sendQueryWhatsApp } from '../utils/whatsapp.js';

/* ─────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────── */

/** Upload a buffer to Cloudinary and return { url, publicId } */
const uploadToCloudinary = (buffer, folder = 'query-photos') =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });

/** Append a timeline event to a query document (mutates in-memory, caller saves) */
const addTimeline = (query, event, actor, actorRole, remark = '') => {
  query.timeline.push({ event, actor, actorRole, remark, createdAt: new Date() });
};

/* ─────────────────────────────────────────────────────────────
   CREATE QUERY  (superadmin only)
   ───────────────────────────────────────────────────────────── */
export const createQuery = async (req, res) => {
  try {
    const { locationId, category, title, description, priority } = req.body;
    const superadmin = req.user;

    if (superadmin.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmin can raise queries' });
    }

    const location = await Location.findOne({ _id: locationId, superadmin: superadmin._id });
    if (!location) {
      return res.status(404).json({ message: 'Location not found or not owned by you' });
    }

    const query = new Query({
      location: location._id,
      locationName: location.name,
      thana:        location.thana,
      district:     location.district || '',
      superadmin:   superadmin._id,
      category,
      title,
      description: description || '',
      priority: priority || 'medium',
      status: 'open',
    });

    addTimeline(query, 'Query raised', superadmin.name, 'superadmin', title);

    await query.save();

    /* ── In-app notifications ── */
    const io = req.app.get('io');

    // Notify all company users
    await notifyCompany(io, {
      sender: superadmin._id,
      type: 'query_raised',
      title: `New Query: ${title}`,
      message: `${superadmin.name} raised a ${category} query for ${location.name}`,
      location: location._id,
    });

    /* ── WhatsApp to company numbers ── */
    const companyUsers = await User.find({ role: 'company', isActive: true });
    const companyPhones = companyUsers.flatMap(u => u.alertPhones || []).filter(Boolean);

    if (companyPhones.length > 0) {
      const waResults = await sendQueryWhatsApp(companyPhones, {
        siteName:       location.name,
        thana:          location.thana,
        district:       location.district || '',
        category,
        title,
        priority:       priority || 'medium',
        superadminName: superadmin.name,
        status:         'open',
        queryId:        query._id.toString().slice(-6).toUpperCase(),
        time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      });
      const waFailed = waResults.filter(r => !r.ok && !r.skipped);
      if (waFailed.length > 0) {
        console.error(`❌ WhatsApp query delivery failed for ${waFailed.length} number(s):`, waFailed.map(r => `${r.phone}: ${r.error}`).join(', '));
      }
    }

    res.status(201).json(query);
  } catch (e) {
    console.error('createQuery error:', e);
    res.status(500).json({ message: e.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET QUERIES  (role-scoped)
   ───────────────────────────────────────────────────────────── */
export const getQueries = async (req, res) => {
  try {
    const user = req.user;
    const { status, category, locationId, priority, page = 1, limit = 20 } = req.query;

    const filter = {};

    // Scope by role
    if (user.role === 'superadmin') {
      filter.superadmin = user._id;
    } else if (!['company', 'queryAdmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Not authorized to view queries' });
    }

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (locationId) filter.location = locationId;
    if (priority) filter.priority = priority;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Query.countDocuments(filter);

    const queries = await Query.find(filter)
      .populate('location', 'name thana district')
      .populate('superadmin', 'name email')
      .populate('resolution.resolvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ queries, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET SINGLE QUERY
   ───────────────────────────────────────────────────────────── */
export const getQuery = async (req, res) => {
  try {
    const user = req.user;
    const query = await Query.findById(req.params.id)
      .populate('location', 'name thana district latitude longitude')
      .populate('superadmin', 'name email alertPhones')
      .populate('resolution.resolvedBy', 'name email')
      .populate('rejectedBy', 'name email');

    if (!query) return res.status(404).json({ message: 'Query not found' });

    // Scope check
    if (user.role === 'superadmin' && query.superadmin._id.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'Not your query' });
    }
    if (!['company', 'queryAdmin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(query);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   COMPANY: ACCEPT / REJECT QUERY
   ───────────────────────────────────────────────────────────── */
export const reviewQuery = async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ message: 'Only company can review queries' });
    }

    const { action, rejectionReason } = req.body; // action: 'approve' | 'reject'
    const query = await Query.findById(req.params.id);
    if (!query) return res.status(404).json({ message: 'Query not found' });

    if (query.status !== 'open') {
      return res.status(400).json({ message: `Query is already ${query.status}` });
    }

    const io = req.app.get('io');

    if (action === 'approve') {
      query.status = 'in_progress';
      addTimeline(query, 'Approved by company — assigned for resolution', req.user.name, 'company');
    } else if (action === 'reject') {
      if (!rejectionReason?.trim()) {
        return res.status(400).json({ message: 'Rejection reason is required' });
      }
      query.status = 'rejected';
      query.rejectionReason = rejectionReason.trim();
      query.rejectedBy = req.user._id;
      query.rejectedAt = new Date();
      addTimeline(query, `Rejected: ${rejectionReason}`, req.user.name, 'company', rejectionReason);
    } else {
      return res.status(400).json({ message: 'Invalid action. Use approve or reject' });
    }

    await query.save();

    // Notify the superadmin
    const eventLabel = action === 'approve' ? 'approved' : 'rejected';
    await notifySuperadmin(io, query.superadmin, {
      sender: req.user._id,
      type: `query_${eventLabel}`,
      title: `Query ${eventLabel}: ${query.title}`,
      message: action === 'reject'
        ? `Your query was rejected: ${rejectionReason}`
        : 'Your query has been approved and is now in progress',
      location: query.location,
    });

    res.json(query);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   QUERY ADMIN: RESOLVE QUERY
   Files expected (multipart form-data):
     resolverPhoto  (1 file)  — selfie of person who resolved
     photos         (1-10)    — proof-of-work images
   Body fields:
     resolverName   — actual person's name (since queryAdmin id is generic)
     details        — resolution notes
   ───────────────────────────────────────────────────────────── */
export const resolveQuery = async (req, res) => {
  try {
    if (req.user.role !== 'queryAdmin') {
      return res.status(403).json({ message: 'Only queryAdmin can resolve queries' });
    }

    const query = await Query.findById(req.params.id);
    if (!query) return res.status(404).json({ message: 'Query not found' });

    if (!['open', 'in_progress'].includes(query.status)) {
      return res.status(400).json({ message: `Cannot resolve a ${query.status} query` });
    }

    const { resolverName, details } = req.body;
    if (!resolverName?.trim()) {
      return res.status(400).json({ message: 'Resolver name is required' });
    }
    if (!details?.trim()) {
      return res.status(400).json({ message: 'Resolution details are required' });
    }

    // Upload proof photos
    const files = req.files || {};
    const proofFiles  = Array.isArray(files.photos) ? files.photos
                      : files.photos ? [files.photos] : [];
    const selfieFiles = Array.isArray(files.resolverPhoto) ? files.resolverPhoto
                      : files.resolverPhoto ? [files.resolverPhoto] : [];

    let resolverPhoto = null;
    if (selfieFiles.length > 0) {
      resolverPhoto = await uploadToCloudinary(selfieFiles[0].buffer, 'query-resolver-photos');
    }

    const uploadedProofs = await Promise.all(
      proofFiles.map(f => uploadToCloudinary(f.buffer, 'query-proof-photos'))
    );

    query.status = 'resolved';
    query.resolution = {
      resolvedBy:    req.user._id,
      resolverName:  resolverName.trim(),
      resolverPhoto: resolverPhoto,
      details:       details.trim(),
      resolvedAt:    new Date(),
      photos:        uploadedProofs,
    };

    addTimeline(
      query,
      `Resolved by ${resolverName.trim()} (via queryAdmin: ${req.user.name})`,
      resolverName.trim(),
      'queryAdmin',
      details.trim()
    );

    await query.save();

    const io = req.app.get('io');

    // Notify superadmin
    await notifySuperadmin(io, query.superadmin, {
      sender: req.user._id,
      type: 'query_resolved',
      title: `Query Resolved: ${query.title}`,
      message: `Your query at ${query.locationName} has been resolved by ${resolverName.trim()}`,
      location: query.location,
    });

    // Notify company
    await notifyCompany(io, {
      sender: req.user._id,
      type: 'query_resolved',
      title: `Query Resolved: ${query.title}`,
      message: `${resolverName.trim()} resolved the ${query.category} query at ${query.locationName}`,
      location: query.location,
    });

    res.json(query);
  } catch (e) {
    console.error('resolveQuery error:', e);
    res.status(500).json({ message: e.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET QUERIES BY LOCATION (for location detail page / PDF)
   ───────────────────────────────────────────────────────────── */
export const getQueriesByLocation = async (req, res) => {
  try {
    const user = req.user;
    const { locationId } = req.params;
    const { status } = req.query;

    // Must own the location (superadmin) or be company/queryAdmin
    if (user.role === 'superadmin') {
      const loc = await Location.findOne({ _id: locationId, superadmin: user._id });
      if (!loc) return res.status(403).json({ message: 'Not your location' });
    } else if (!['company', 'queryAdmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const filter = { location: locationId };
    if (status) filter.status = status;

    const queries = await Query.find(filter)
      .populate('superadmin', 'name email')
      .populate('resolution.resolvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(queries);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET QUERY STATS  (summary counts for dashboard)
   ───────────────────────────────────────────────────────────── */
export const getQueryStats = async (req, res) => {
  try {
    const user = req.user;
    const filter = {};

    if (user.role === 'superadmin') {
      filter.superadmin = user._id;
    } else if (!['company', 'queryAdmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const [total, open, inProgress, resolved, rejected] = await Promise.all([
      Query.countDocuments(filter),
      Query.countDocuments({ ...filter, status: 'open' }),
      Query.countDocuments({ ...filter, status: 'in_progress' }),
      Query.countDocuments({ ...filter, status: 'resolved' }),
      Query.countDocuments({ ...filter, status: 'rejected' }),
    ]);

    res.json({ total, open, inProgress, resolved, rejected });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET QUERY TIMELINE
   ───────────────────────────────────────────────────────────── */
export const getQueryTimeline = async (req, res) => {
  try {
    const user = req.user;
    const query = await Query.findById(req.params.id).select('timeline title status superadmin locationName');
    if (!query) return res.status(404).json({ message: 'Query not found' });

    if (user.role === 'superadmin' && query.superadmin.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'Not your query' });
    }
    if (!['company', 'queryAdmin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json({ timeline: query.timeline, title: query.title, status: query.status, locationName: query.locationName });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   SUPERADMIN: RE-OPEN A REJECTED QUERY
   ───────────────────────────────────────────────────────────── */
export const reopenQuery = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmin can reopen queries' });
    }

    const query = await Query.findOne({ _id: req.params.id, superadmin: req.user._id });
    if (!query) return res.status(404).json({ message: 'Query not found' });

    if (query.status !== 'rejected') {
      return res.status(400).json({ message: 'Only rejected queries can be reopened' });
    }

    const { remark } = req.body;
    query.status = 'open';
    query.rejectionReason = '';
    query.rejectedBy = null;
    query.rejectedAt = null;
    addTimeline(query, `Reopened by superadmin`, req.user.name, 'superadmin', remark || '');

    await query.save();

    const io = req.app.get('io');
    await notifyCompany(io, {
      sender: req.user._id,
      type: 'query_reopened',
      title: `Query Reopened: ${query.title}`,
      message: `${req.user.name} reopened a ${query.category} query for ${query.locationName}`,
      location: query.location,
    });

    res.json(query);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};