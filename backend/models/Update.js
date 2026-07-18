import mongoose from 'mongoose';

const updateSchema = new mongoose.Schema({
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  superadmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // 'camera' | 'wifi' | 'power'
  type: { type: String, enum: ['camera', 'wifi', 'power'], required: true },

  // How many units this single update represents (e.g. "3 cameras installed").
  // Power supply is a simple connect → always 1.
  installedCount: { type: Number, default: 1, min: 1 },

  // For 'power', title/description/installationDate are optional (just informing
  // that power supply is connected, with an optional remark).
  title: { type: String, trim: true },
  description: { type: String },
  photos: [{ url: String, publicId: String }],

  latitude: { type: Number },
  longitude: { type: Number },
  installationDate: { type: Date },

  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
  },

  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  rejectionReason: { type: String },
  resubmissionCount: { type: Number, default: 0 },

  previousVersions: [{
    title: String,
    description: String,
    photos: [{ url: String, publicId: String }],
    installedCount: Number,
    latitude: Number,
    longitude: Number,
    installationDate: Date,
    submittedAt: Date,
    rejectionReason: String,
  }],
}, { timestamps: true });

updateSchema.index({ location: 1, type: 1, status: 1 });
updateSchema.index({ superadmin: 1, status: 1 });
updateSchema.index({ submittedBy: 1 });

export default mongoose.model('Update', updateSchema);