import mongoose from 'mongoose';

/**
 * Short-lived phone-number verification used before an anonymous user
 * is allowed to raise an alert from a public location page.
 * Documents auto-expire 10 minutes after creation via a TTL index.
 */
const otpSchema = new mongoose.Schema({
  phone:    { type: String, required: true, index: true },
  codeHash: { type: String, required: true },     // hashed OTP, never stored plain
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  attempts: { type: Number, default: 0 },          // wrong-code attempts
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// TTL — record disappears 10 minutes after creation
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

export default mongoose.model('Otp', otpSchema);
