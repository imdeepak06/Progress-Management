import mongoose from 'mongoose';

/**
 * An Alert is raised by ANY person (no login) from the public location page
 * reachable via the location QR code. The sender first verifies their phone
 * number with a WhatsApp OTP, then submits the alert (with an optional remark).
 *
 * Alerts are visible to the location's superadmin and to all company users.
 * The superadmin can mark an alert as read (optionally with a remark).
 * Company can view alerts + their progress but cannot mark/raise them.
 */
const alertSchema = new mongoose.Schema({
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
    index: true,
  },
  // Denormalised so alerts remain meaningful even if a location is renamed/removed
  locationName: { type: String, default: '' },
  thana:        { type: String, default: '' },
  district:     { type: String, default: '' },
  latitude:     { type: Number },
  longitude:    { type: Number },

  // The superadmin who owns this location (for scoping the alerts tab)
  superadmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // Person who raised the alert (verified via WhatsApp OTP)
  senderPhone: { type: String, required: true },
  remark:      { type: String, default: '' }, // optional message from sender

  // Read tracking — superadmin marks read, optionally with a remark
  isRead:        { type: Boolean, default: false, index: true },
  readAt:        { type: Date },
  readBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adminRemark:   { type: String, default: '' },
}, { timestamps: true });

alertSchema.index({ superadmin: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('Alert', alertSchema);
