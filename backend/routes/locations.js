import express from 'express';
import multer from 'multer';
import {
  createLocation, getLocations, getLocation,
  updateLocation, deleteLocation, getProgressStats,
  bulkUploadLocations, updateRecceData,
  getYamunaLocations,
  getEquipment, updateEquipment,
  addLocationRemark, deleteLocationRemark,
  requestControlRoom, reviewControlRoom,
  getControlRoomTrail, getPendingControlRoomRequests,
} from '../controllers/locationController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.includes('spreadsheet') ||
      file.mimetype.includes('excel') ||
      file.originalname.match(/\.(xlsx|xls)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx or .xls files allowed'));
    }
  },
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'));
    }
  },
});

router.get('/yamuna-nagar', getYamunaLocations);

router.patch(
  '/:id/recce',
  imageUpload.array('defaultImages', 10),
  updateRecceData
);

router.use(protect);

router.get('/stats', getProgressStats);
router.get('/', getLocations);
router.post('/', createLocation);
router.post(
  '/bulk-upload',
  authorize('company'),
  excelUpload.single('excel'),
  bulkUploadLocations
);

// NVR / WIFI credential tables (company + admin)
router.get('/:id/equipment', authorize('company', 'admin'), getEquipment);
router.put('/:id/equipment', authorize('company', 'admin'), updateEquipment);

// Location remarks (company only)
router.post('/:id/remarks', authorize('company'), addLocationRemark);
router.delete('/:id/remarks/:remarkId', authorize('company'), deleteLocationRemark);

// ── Control Room routes ────────────────────────────────────────────────────
// GET pending requests for superadmin (must come before /:id routes)
router.get('/control-room/pending', authorize('superadmin'), getPendingControlRoomRequests);

// Admin (ground) requests connection
router.post('/:id/control-room/request', authorize('admin'), requestControlRoom);

// Superadmin accepts or rejects
router.post('/:id/control-room/review', authorize('superadmin'), reviewControlRoom);

// Read full trail (company, superadmin, admin)
router.get('/:id/control-room/trail', authorize('company', 'superadmin', 'admin'), getControlRoomTrail);

router.get('/:id', getLocation);
router.put('/:id', updateLocation);
router.delete('/:id', deleteLocation);

export default router;