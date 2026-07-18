import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: {
    type: String,
    enum: [
      'update_submitted', 
      'update_verified', 
      'update_rejected', 
      'update_resubmitted',
      'alert_raised',
      'control_room_request',
      'control_room_accepted',
      'control_room_rejected'
    ],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  update: { type: mongoose.Schema.Types.ObjectId, ref: 'Update' },
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);