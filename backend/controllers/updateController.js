import Update from '../models/Update.js';
import Location from '../models/Location.js';
import cloudinary from '../config/cloudinary.js';
import { notifyCompany, notifySuperadmin, createNotification } from '../utils/notifications.js';

// Upload files to Cloudinary using base64 — works reliably with multer memoryStorage
const uploadPhotosToCloudinary = async (files) => {
  if (!files || files.length === 0) return [];

  const results = [];
  for (const f of files) {
    const b64 = `data:${f.mimetype};base64,${f.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(b64, {
      folder: 'fieldops/updates',
      resource_type: 'image',
    });
    results.push({ url: result.secure_url, publicId: result.public_id });
  }
  return results;
};

// Sum of verified installedCount for a location+type (count-based progress)
const verifiedUnits = async (locationId, type) => {
  const rows = await Update.aggregate([
    { $match: { location: new (await import('mongoose')).default.Types.ObjectId(String(locationId)), type, status: 'verified' } },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$installedCount', 1] } } } },
  ]);
  return rows[0]?.total || 0;
};

const plannedFor = (location, type) =>
  type === 'camera' ? (location.cameraConfig?.noOfCameras || 0) :
  type === 'wifi'   ? (location.wifiConfig?.noOfWifi      || 0) :
                      (location.powerConfig?.noOfPower     || 0);

export const submitUpdate = async (req, res) => {
  try {
    const io = req.app.get('io');
    const { locationId, title, description, latitude, longitude, installationDate } = req.body;

    // Admin is the unified operator. The equipment type comes from the request body.
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin users can submit updates' });
    }

    const type = req.body.type; // 'camera' | 'wifi' | 'power'
    if (!['camera', 'wifi', 'power'].includes(type)) {
      return res.status(400).json({ message: 'Invalid update type' });
    }

    const location = await Location.findById(locationId);
    if (!location) return res.status(404).json({ message: 'Location not found' });

    if (req.user.superadminId?.toString() !== location.superadmin.toString()) {
      return res.status(403).json({ message: 'You cannot submit for this location' });
    }

    // installedCount: number of units in this single update (cameras / wifi).
    // Power supply is a simple connect → always 1.
    let installedCount = 1;
    if (type !== 'power') {
      installedCount = parseInt(req.body.installedCount, 10) || 1;
      if (installedCount < 1) installedCount = 1;
    }

    const planned = plannedFor(location, type);
    if (planned > 0) {
      const already = await verifiedUnits(locationId, type);
      if (already >= planned) {
        return res.status(400).json({ message: `All ${planned} ${type}(s) already verified for this location.` });
      }
    }

    const photos = await uploadPhotosToCloudinary(req.files);

    // Power supply: only an optional remark, no required fields.
    const isPower = type === 'power';
    const finalTitle = isPower
      ? (title?.trim() || 'Power supply connected')
      : (title?.trim() || `${type} update`);
    const finalDescription = isPower
      ? (description?.trim() || 'Power supply has been connected.')
      : (description || '');

    const update = await Update.create({
      location: locationId,
      superadmin: location.superadmin,
      submittedBy: req.user._id,
      type,
      installedCount,
      title: finalTitle,
      description: finalDescription,
      photos,
      latitude: latitude || location.latitude,
      longitude: longitude || location.longitude,
      installationDate: installationDate ? new Date(installationDate) : new Date(),
      status: 'pending',
    });

    await update.populate(['location', 'submittedBy']);

    const countLabel = !isPower && installedCount > 1 ? ` (${installedCount} units)` : '';
    await notifyCompany(io, {
      sender: req.user._id,
      type: 'update_submitted',
      title: `New ${type.toUpperCase()} Update`,
      message: `${req.user.name} submitted a ${type} update${countLabel} for ${location.name}`,
      update: update._id,
      location: locationId,
    });

    res.status(201).json(update);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const reviewUpdate = async (req, res) => {
  try {
    const io = req.app.get('io');
    const { action, rejectionReason } = req.body;

    if (!['verify', 'reject'].includes(action)) return res.status(400).json({ message: 'Invalid action' });
    if (action === 'reject' && !rejectionReason?.trim()) return res.status(400).json({ message: 'Rejection reason required' });

    const update = await Update.findById(req.params.id).populate(['location', 'submittedBy']);
    if (!update) return res.status(404).json({ message: 'Update not found' });
    if (update.status !== 'pending') return res.status(400).json({ message: 'Already reviewed' });

    update.status     = action === 'verify' ? 'verified' : 'rejected';
    update.reviewedBy = req.user._id;
    update.reviewedAt = new Date();
    if (action === 'reject') update.rejectionReason = rejectionReason;
    await update.save();

    if (action === 'verify') {
      await createNotification(io, {
        recipient: update.submittedBy._id,
        sender: req.user._id,
        type: 'update_verified',
        title: 'Update Verified ✓',
        message: `Your ${update.type} update for ${update.location.name} was verified!`,
        update: update._id,
        location: update.location._id,
      });
      await notifySuperadmin(io, update.superadmin, {
        sender: req.user._id,
        type: 'update_verified',
        title: `${update.type.toUpperCase()} Verified`,
        message: `${update.location.name} — ${update.title} verified`,
        update: update._id,
        location: update.location._id,
      });
    } else {
      await createNotification(io, {
        recipient: update.submittedBy._id,
        sender: req.user._id,
        type: 'update_rejected',
        title: 'Update Rejected ✗',
        message: `Your ${update.type} update for ${update.location.name} was rejected. Reason: ${rejectionReason}`,
        update: update._id,
        location: update.location._id,
      });
    }

    res.json(update);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const resubmitUpdate = async (req, res) => {
  try {
    const io = req.app.get('io');
    const { title, description, latitude, longitude, installationDate } = req.body;

    const update = await Update.findById(req.params.id).populate('location');
    if (!update) return res.status(404).json({ message: 'Update not found' });
    if (update.submittedBy.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    if (update.status !== 'rejected') return res.status(400).json({ message: 'Only rejected updates can be resubmitted' });

    update.previousVersions.push({
      title: update.title, description: update.description,
      photos: update.photos, installedCount: update.installedCount,
      latitude: update.latitude,
      longitude: update.longitude, installationDate: update.installationDate,
      submittedAt: update.updatedAt, rejectionReason: update.rejectionReason,
    });

    const newPhotos = req.files?.length
      ? await uploadPhotosToCloudinary(req.files)
      : update.photos;

    if (req.body.installedCount !== undefined && update.type !== 'power') {
      const c = parseInt(req.body.installedCount, 10);
      if (!isNaN(c) && c >= 1) update.installedCount = c;
    }

    update.title             = title            || update.title;
    update.description       = description      || update.description;
    update.photos            = newPhotos;
    update.latitude          = latitude         || update.latitude;
    update.longitude         = longitude        || update.longitude;
    update.installationDate  = installationDate ? new Date(installationDate) : update.installationDate;
    update.status            = 'pending';
    update.rejectionReason   = undefined;
    update.reviewedBy        = undefined;
    update.reviewedAt        = undefined;
    update.resubmissionCount += 1;

    await update.save();
    await update.populate(['location', 'submittedBy']);

    await notifyCompany(io, {
      sender: req.user._id,
      type: 'update_resubmitted',
      title: 'Update Resubmitted',
      message: `${req.user.name} resubmitted ${update.type} update for ${update.location.name}`,
      update: update._id,
      location: update.location._id,
    });

    res.json(update);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const getUpdates = async (req, res) => {
  try {
    const { type, status, locationId, superadminId } = req.query;
    let filter = {};

    if (type)       filter.type     = type;
    if (status)     filter.status   = status;
    if (locationId) filter.location = locationId;

    if (req.user.role === 'company') {
      if (superadminId) filter.superadmin = superadminId;
    } else if (req.user.role === 'superadmin') {
      filter.superadmin = req.user._id;
    } else {
      filter.submittedBy = req.user._id;
    }

    const updates = await Update.find(filter)
      .populate('location', 'name thana district')
      .populate('submittedBy', 'name role')
      .populate('superadmin', 'name')
      .populate('reviewedBy', 'name')
      .sort('-createdAt');

    res.json(updates);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const getUpdate = async (req, res) => {
  try {
    const update = await Update.findById(req.params.id)
      .populate('location', 'name thana district latitude longitude')
      .populate('submittedBy', 'name role email')
      .populate('superadmin', 'name')
      .populate('reviewedBy', 'name');
    if (!update) return res.status(404).json({ message: 'Update not found' });
    res.json(update);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const uploadPhotosToUpdate = async (req, res) => {
  try {
    // Both company and admin can add photos to timeline updates.
    if (!['company', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only company or admin can upload photos to updates' });
    }

    const update = await Update.findById(req.params.id);
    if (!update) return res.status(404).json({ message: 'Update not found' });

    // Admin can only add photos to updates for their own superadmin's locations.
    if (req.user.role === 'admin' &&
        req.user.superadminId?.toString() !== update.superadmin?.toString()) {
      return res.status(403).json({ message: 'Not authorized for this update' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No photos provided' });
    }

    const newPhotos = await uploadPhotosToCloudinary(req.files);
    update.photos = [...(update.photos || []), ...newPhotos];
    await update.save();

    await update.populate([
      { path: 'location' },
      { path: 'submittedBy' },
      ...(update.reviewedBy ? [{ path: 'reviewedBy' }] : []),
    ]);

    res.json(update);
  } catch (e) {
    console.error('uploadPhotosToUpdate error:', e);
    res.status(500).json({ message: e.message });
  }
};

export const getTimelineByLocation = async (req, res) => {
  try {
    const updates = await Update.find({ location: req.params.locationId })
      .populate('submittedBy', 'name role')
      .populate('reviewedBy', 'name')
      .sort('createdAt');
    res.json(updates);
  } catch (e) { res.status(500).json({ message: e.message }); }
};