import express from 'express';
import {
  getPublicLocation, sendOtp, verifyOtpAndAlert,
  getAlerts, getAlertUnreadCount, markAlertRead,
  getLocationQr, getAllLocationQrs,
} from '../controllers/alertController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

/* ── PUBLIC (no auth) — used by the QR landing page ── */
router.get('/public/location/:id', getPublicLocation);
router.post('/public/location/:id/otp', sendOtp);
router.post('/public/location/:id/alert', verifyOtpAndAlert);

/* ── PROTECTED ── */
router.use(protect);

// QR downloads — company only (enforced again in controller)
router.get('/qr/all', authorize('company'), getAllLocationQrs);
router.get('/qr/:id', authorize('company'), getLocationQr);

// Alerts tab — company + superadmin
router.get('/', authorize('company', 'superadmin'), getAlerts);
router.get('/unread-count', authorize('company', 'superadmin'), getAlertUnreadCount);
router.put('/:id/read', authorize('superadmin'), markAlertRead);

export default router;
