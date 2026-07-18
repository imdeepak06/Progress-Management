import express from 'express';
import { submitUpdate, reviewUpdate, resubmitUpdate, getUpdates, getUpdate, getTimelineByLocation, uploadPhotosToUpdate } from '../controllers/updateController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../config/cloudinary.js';

const router = express.Router();

router.use(protect);

router.get('/', getUpdates);

// IMPORTANT: /timeline/:locationId must be BEFORE /:id
router.get('/timeline/:locationId', getTimelineByLocation);

router.get('/:id', getUpdate);
router.post('/', authorize('admin'), upload.array('photos', 10), submitUpdate);
router.put('/:id/review', authorize('company'), reviewUpdate);
// Both company and admin can add photos to a timeline update
router.post('/:id/photos', authorize('company', 'admin'), upload.array('photos', 20), uploadPhotosToUpdate);
router.put('/:id/resubmit', authorize('admin'), upload.array('photos', 10), resubmitUpdate);

export default router;