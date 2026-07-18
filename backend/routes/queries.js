import express from 'express';
import { upload } from '../config/cloudinary.js';
import { protect, authorize } from '../middleware/auth.js';
import {
  createQuery,
  getQueries,
  getQuery,
  reviewQuery,
  resolveQuery,
  getQueriesByLocation,
  getQueryStats,
  getQueryTimeline,
  reopenQuery,
} from '../controllers/queryController.js';

const router = express.Router();

router.use(protect);

// Stats — dashboard summary
router.get('/stats', authorize('company', 'superadmin', 'queryAdmin'), getQueryStats);

// By location (for location detail page and PDF export)
router.get('/location/:locationId', authorize('company', 'superadmin', 'queryAdmin'), getQueriesByLocation);

// Timeline of a specific query
router.get('/:id/timeline', authorize('company', 'superadmin', 'queryAdmin'), getQueryTimeline);

// List + Create
router.get('/',  authorize('company', 'superadmin', 'queryAdmin'), getQueries);
router.post('/', authorize('superadmin'),                           createQuery);

// Single query
router.get('/:id', authorize('company', 'superadmin', 'queryAdmin'), getQuery);

// Company review (approve / reject)
router.put('/:id/review', authorize('company'), reviewQuery);

// QueryAdmin resolution (with selfie + proof photos)
router.put(
  '/:id/resolve',
  authorize('queryAdmin'),
  upload.fields([
    { name: 'resolverPhoto', maxCount: 1 },
    { name: 'photos',        maxCount: 10 },
  ]),
  resolveQuery
);

// Superadmin reopen rejected query
router.put('/:id/reopen', authorize('superadmin'), reopenQuery);

export default router;