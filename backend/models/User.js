import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role: {
    type: String,
    /**
     * company     — top-level company account (full visibility, reviews queries & updates)
     * superadmin  — owns locations, raises queries, submits updates via admin/recce staff
     * admin       — field operator for a superadmin (submits camera/wifi/power updates)
     * recce       — field recce operator for a superadmin
     * queryAdmin  — resolves queries on-site; id is generic/shared (photo captured on resolve)
     */
    enum: ['company', 'superadmin', 'admin', 'recce', 'queryAdmin'],
    required: true,
  },
  // Which superadmin this operator belongs to (for admin / recce)
  superadminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  // Created by whom
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  isActive: { type: Boolean, default: true },
  avatar: { type: String, default: '' },

  // Phone numbers (E.164 e.g. 919812345678) that receive WhatsApp alerts.
  // - superadmin: receives alerts for ALL of that superadmin's locations
  // - company: receives alerts for ALL locations across the system
  alertPhones: { type: [String], default: [] },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model('User', userSchema);