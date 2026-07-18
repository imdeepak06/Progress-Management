import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import Alert from '../models/Alert.js';
import Otp from '../models/Otp.js';
import Location from '../models/Location.js';
import User from '../models/User.js';
import { sendOtpWhatsApp, generateOtp, sendAlertWhatsAppBulk, normalizePhone } from '../utils/whatsapp.js';
import { buildQrPosterSvg } from '../utils/qr.js';
import { notifySuperadmin, notifyCompany } from '../utils/notifications.js';

const MAX_OTP_ATTEMPTS = 5;

const publicBaseUrl = () =>
  process.env.PUBLIC_BASE_URL || process.env.CLIENT_URL || 'http://localhost:5173';

/* ─────────────────────────────────────────────────────────────
   PUBLIC: get minimal location details for the QR landing page
   (no auth — anyone who scans can see name/thana/district/coords/image)
   ───────────────────────────────────────────────────────────── */
export const getPublicLocation = async (req, res) => {
  try {
    const loc = await Location.findById(req.params.id).select(
      'name thana district latitude longitude defaultImage isActive'
    );
    if (!loc || !loc.isActive) return res.status(404).json({ message: 'Location not found' });
    res.json({
      _id: loc._id,
      name: loc.name,
      thana: loc.thana,
      district: loc.district,
      latitude: loc.latitude,
      longitude: loc.longitude,
      defaultImage: loc.defaultImage,
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

/* ─────────────────────────────────────────────────────────────
   PUBLIC: send a WhatsApp OTP to verify the alerter's phone
   ───────────────────────────────────────────────────────────── */
export const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    const locationId = req.params.id;
    const norm = normalizePhone(phone);
    if (!norm || norm.length < 8) return res.status(400).json({ message: 'Valid phone number required' });

    const loc = await Location.findById(locationId).select('isActive');
    if (!loc || !loc.isActive) return res.status(404).json({ message: 'Location not found' });

    // Generate 6-digit code, store only its hash
    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, 8);

    // Replace any existing OTP for this phone+location
    await Otp.deleteMany({ phone: norm, location: locationId });
    await Otp.create({ phone: norm, codeHash, location: locationId });

    const waResult = await sendOtpWhatsApp(norm, code);
    if (!waResult.ok && !waResult.skipped) {
      console.error('OTP WhatsApp delivery failed:', waResult.error);
    }

    res.json({ message: 'OTP sent on WhatsApp' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

/* ─────────────────────────────────────────────────────────────
   PUBLIC: verify OTP + raise the alert (optional remark)
   ───────────────────────────────────────────────────────────── */
export const verifyOtpAndAlert = async (req, res) => {
  try {
    const { phone, code, remark } = req.body;
    const locationId = req.params.id;
    const norm = normalizePhone(phone);
    if (!norm || !code) return res.status(400).json({ message: 'Phone and code required' });

    const otp = await Otp.findOne({ phone: norm, location: locationId }).sort('-createdAt');
    if (!otp) return res.status(400).json({ message: 'OTP expired or not found. Request a new code.' });

    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      await Otp.deleteOne({ _id: otp._id });
      return res.status(429).json({ message: 'Too many attempts. Request a new code.' });
    }

    const match = await bcrypt.compare(String(code), otp.codeHash);
    if (!match) {
      otp.attempts += 1;
      await otp.save();
      return res.status(400).json({ message: 'Incorrect code' });
    }

    // OTP good — consume it
    await Otp.deleteOne({ _id: otp._id });

    const loc = await Location.findById(locationId);
    if (!loc || !loc.isActive) return res.status(404).json({ message: 'Location not found' });

    const alert = await Alert.create({
      location: loc._id,
      locationName: loc.name,
      thana: loc.thana,
      district: loc.district,
      latitude: loc.latitude,
      longitude: loc.longitude,
      superadmin: loc.superadmin,
      senderPhone: norm,
      remark: (remark || '').trim().slice(0, 500),
    });

    // ── Fan-out WhatsApp alerts to all three levels ──
    const sa = await User.findById(loc.superadmin).select('alertPhones');
    const companies = await User.find({ role: 'company', isActive: true }).select('alertPhones');

    const recipients = [
      ...(loc.alertPhones || []),                       // this location's numbers
      ...((sa && sa.alertPhones) || []),                // its superadmin's numbers
      ...companies.flatMap((c) => c.alertPhones || []), // all company numbers
    ];

    const alertData = {
      siteName: loc.name,
      thana: loc.thana,
      district: loc.district,
      senderPhone: norm,
      remark: alert.remark,
      latitude: loc.latitude,
      longitude: loc.longitude,
      time: new Date(alert.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    };

    const waResults = await sendAlertWhatsAppBulk(recipients, alertData);
    const waFailed = waResults.filter(r => !r.ok && !r.skipped);
    if (waFailed.length > 0) {
      console.error(`❌ WhatsApp alert delivery failed for ${waFailed.length} number(s):`, waFailed.map(r => `${r.phone}: ${r.error}`).join(", "));
    }

    // ── In-app notifications (re-uses existing notification system) ──
    const io = req.app.get('io');
    notifySuperadmin(io, loc.superadmin, {
      sender: null,
      type: 'alert_raised',
      title: '🚨 New alert',
      message: `Alert raised at ${loc.name}${alert.remark ? ` — ${alert.remark}` : ''}`,
      location: loc._id,
    }).catch(() => {});
    notifyCompany(io, {
      sender: null,
      type: 'alert_raised',
      title: '🚨 New alert',
      message: `Alert raised at ${loc.name} (${loc.thana || '-'})`,
      location: loc._id,
    }).catch(() => {});

    res.status(201).json({ message: 'Alert sent', alertId: alert._id });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

/* ─────────────────────────────────────────────────────────────
   AUTH: list alerts (company = all, superadmin = own locations)
   filters: ?status=read|unread  &from=ISO  &to=ISO  &locationId=
   ───────────────────────────────────────────────────────────── */
export const getAlerts = async (req, res) => {
  try {
    const { status, from, to, locationId } = req.query;
    const filter = {};

    if (req.user.role === 'superadmin') filter.superadmin = req.user._id;
    else if (req.user.role !== 'company') return res.status(403).json({ message: 'Forbidden' });

    if (locationId) filter.location = locationId;
    if (status === 'read')   filter.isRead = true;
    if (status === 'unread') filter.isRead = false;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const alerts = await Alert.find(filter)
      .populate('location', 'name thana district')
      .populate('readBy', 'name role')
      .populate('superadmin', 'name')
      .sort('-createdAt')
      .limit(500);

    const unreadCount = await Alert.countDocuments({ ...filter, isRead: false });
    res.json({ alerts, unreadCount });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const getAlertUnreadCount = async (req, res) => {
  try {
    const filter = { isRead: false };
    if (req.user.role === 'superadmin') filter.superadmin = req.user._id;
    else if (req.user.role !== 'company') return res.json({ count: 0 });
    const count = await Alert.countDocuments(filter);
    res.json({ count });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

/* ─────────────────────────────────────────────────────────────
   AUTH: superadmin marks an alert read (optional remark)
   ───────────────────────────────────────────────────────────── */
export const markAlertRead = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin')
      return res.status(403).json({ message: 'Only superadmin can mark alerts read' });

    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    if (alert.superadmin.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not your alert' });

    alert.isRead = true;
    alert.readAt = new Date();
    alert.readBy = req.user._id;
    if (req.body.adminRemark !== undefined) alert.adminRemark = String(req.body.adminRemark).slice(0, 500);
    await alert.save();

    await alert.populate('readBy', 'name role');
    await alert.populate('location', 'name thana district');
    res.json(alert);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

/* ─────────────────────────────────────────────────────────────
   AUTH: branded QR poster SVG for one location (company only)
   ───────────────────────────────────────────────────────────── */
export const getLocationQr = async (req, res) => {
  try {
    if (req.user.role !== 'company')
      return res.status(403).json({ message: 'Only company can download QR codes' });

    const loc = await Location.findById(req.params.id).select(
      'name thana district latitude longitude defaultImage isActive'
    );
    if (!loc || !loc.isActive) return res.status(404).json({ message: 'Location not found' });

    const company = await User.findById(req.user._id).select('name avatar');
    const url = `${publicBaseUrl()}/public/location/${loc._id}`;

    const svg = await buildQrPosterSvg({
      url,
      companyName: company?.name || 'FieldOps',
      logoDataUri: company?.avatar || '',
      location: loc,
    });

    res.json({ svg, fileName: `QR_${(loc.name || 'location').replace(/[^a-z0-9]+/gi, '_')}.png`, url });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

/* ─────────────────────────────────────────────────────────────
   AUTH: branded QR posters for ALL locations of a superadmin (company only)
   query: ?superadminId=...  (optional; otherwise all locations)
   ───────────────────────────────────────────────────────────── */
export const getAllLocationQrs = async (req, res) => {
  try {
    if (req.user.role !== 'company')
      return res.status(403).json({ message: 'Only company can download QR codes' });

    const { superadminId } = req.query;
    const filter = { isActive: true };
    if (superadminId) filter.superadmin = superadminId;

    const locations = await Location.find(filter).select(
      'name thana district latitude longitude defaultImage'
    );
    if (!locations.length) return res.status(404).json({ message: 'No locations found' });

    const company = await User.findById(req.user._id).select('name avatar');
    const base = publicBaseUrl();

    const items = [];
    for (const loc of locations) {
      const url = `${base}/public/location/${loc._id}`;
      const svg = await buildQrPosterSvg({
        url,
        companyName: company?.name || 'FieldOps',
        logoDataUri: company?.avatar || '',
        location: loc,
      });
      items.push({
        id: loc._id,
        name: loc.name,
        fileName: `QR_${(loc.name || 'location').replace(/[^a-z0-9]+/gi, '_')}.png`,
        svg,
      });
    }

    res.json({ count: items.length, items });
  } catch (e) { res.status(500).json({ message: e.message }); }
};