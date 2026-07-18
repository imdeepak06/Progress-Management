import mongoose from 'mongoose';

/**
 * Query model — after-sale service queries raised by superadmin.
 *
 * Lifecycle:
 *   open  →  in_progress  →  resolved
 *         →  rejected  (by company)
 *
 * Who sees what:
 *   superadmin  : only queries raised by themselves
 *   company     : all queries across all superadmins
 *   queryAdmin  : all queries (read + resolve)
 */

const resolverPhotoSchema = new mongoose.Schema({
  url:      { type: String, required: true },
  publicId: { type: String, default: '' },
}, { _id: false });

const timelineEventSchema = new mongoose.Schema({
  event:     { type: String, required: true },   // human-readable event label
  actor:     { type: String, default: '' },       // name of person who triggered event
  actorRole: { type: String, default: '' },
  remark:    { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const querySchema = new mongoose.Schema({
  // Which location this query belongs to
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
    index: true,
  },
  // Denormalised snapshot (so query remains meaningful even if location changes)
  locationName: { type: String, default: '' },
  thana:        { type: String, default: '' },
  district:     { type: String, default: '' },

  // Superadmin who owns the location / raised the query
  superadmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // Category of issue
  category: {
    type: String,
    enum: ['camera', 'wifi', 'power_supply', 'other'],
    required: true,
  },

  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },

  // Priority set at creation
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },

  // Status lifecycle
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'rejected'],
    default: 'open',
    index: true,
  },

  // Company rejection
  rejectionReason: { type: String, default: '' },
  rejectedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectedAt:      { type: Date },

  // Resolution details — filled by queryAdmin
  resolution: {
    resolvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // queryAdmin user id
    resolverName:    { type: String, default: '' },    // entered manually (generic id usage)
    resolverPhoto:   { type: resolverPhotoSchema, default: null }, // selfie captured at site
    details:         { type: String, default: '' },
    resolvedAt:      { type: Date },
    photos:          { type: [resolverPhotoSchema], default: [] }, // proof-of-resolution images
  },

  // Timeline of all events
  timeline: { type: [timelineEventSchema], default: [] },

}, { timestamps: true });

querySchema.index({ superadmin: 1, status: 1, createdAt: -1 });
querySchema.index({ location: 1, status: 1 });

export default mongoose.model('Query', querySchema);