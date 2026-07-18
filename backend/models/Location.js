import mongoose from "mongoose";

// Single fixed NVR row (visible/editable by company + admin)
const nvrSchema = new mongoose.Schema({
  ipAddress: { type: String, trim: true, default: "" },
  password: { type: String, trim: true, default: "" },
  remark: { type: String, trim: true, default: "" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedAt: { type: Date },
}, { _id: false });

// Single fixed WIFI row (visible/editable by company + admin)
const wifiCredSchema = new mongoose.Schema({
  name: { type: String, trim: true, default: "" },
  password: { type: String, trim: true, default: "" },
  remark: { type: String, trim: true, default: "" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedAt: { type: Date },
}, { _id: false });

// Company remark per location (color-coded status note)
const locationRemarkSchema = new mongoose.Schema({
  text:      { type: String, required: true, trim: true },
  color:     { type: String, enum: ['green', 'yellow', 'red'], default: 'green' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

// ─── Control Room Trail Entry ────────────────────────────────────────────────
// Each action (request / accept / reject / re-request) is appended here.
const controlRoomTrailSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['requested', 'accepted', 'rejected', 're-requested'],
    required: true,
  },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  byName: { type: String },
  byRole: { type: String },
  reason: { type: String, trim: true, default: "" }, // mandatory on reject
  at: { type: Date, default: Date.now },
}, { _id: true });

// ─── Control Room Sub-document ───────────────────────────────────────────────
const controlRoomSchema = new mongoose.Schema({
  // Current connection status
  status: {
    type: String,
    enum: ['not_connected', 'pending', 'connected', 'rejected'],
    default: 'not_connected',
  },
  // Who last requested (admin/ground id)
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  requestedAt: { type: Date, default: null },
  // Who accepted/rejected (superadmin)
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  rejectReason: { type: String, trim: true, default: "" },
  // Full audit trail
  trail: { type: [controlRoomTrailSchema], default: [] },
}, { _id: false });

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  thana: { type: String, required: true, trim: true },
  district: { type: String, trim: true },
  latitude: { type: Number },
  longitude: { type: Number },

  // array of Cloudinary URLs
  defaultImages: { type: [String], default: [] },
  defaultImageSetBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  defaultImageSetAt: { type: Date },

  alertPhones: { type: [String], default: [] },
  superadmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  updatedByName: { type: String },
  updatedByPhone: { type: String },
  updatedByDescription: { type: String },

  cameraConfig: {
    noOfCameras: { type: Number, default: 0 },
    setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    setAt: { type: Date },
  },
  wifiConfig: {
    noOfWifi: { type: Number, default: 0 },
    setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    setAt: { type: Date },
  },
  // Renamed from generatorConfig -> powerConfig (power supply)
  powerConfig: {
    noOfPower: { type: Number, default: 0 },
    setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    setAt: { type: Date },
  },

  // Equipment credential rows — single fixed NVR + single fixed WIFI
  nvr: { type: nvrSchema, default: () => ({}) },
  wifi: { type: wifiCredSchema, default: () => ({}) },

  // Company remarks — color-coded status notes visible in reports
  remarks: { type: [locationRemarkSchema], default: [] },

  // ── Control Room connectivity ─────────────────────────────────────────────
  // Binary field: is the control room connected (yes/no)?
  // Ground (admin) raises a request → superadmin accepts or rejects.
  // Full trail kept for audit / timeline.
  controlRoom: { type: controlRoomSchema, default: () => ({}) },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

locationSchema.index({ superadmin: 1 });

export default mongoose.model('Location', locationSchema);