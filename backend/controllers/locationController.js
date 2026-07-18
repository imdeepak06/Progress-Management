import Location from "../models/Location.js";
import Update from "../models/Update.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import { createNotification, notifySuperadmin } from "../utils/notifications.js";

// Sum of verified installedCount for a location+type
const verifiedUnits = async (locId, type) => {
  const rows = await Update.aggregate([
    { $match: { location: new mongoose.Types.ObjectId(String(locId)), type, status: "verified" } },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$installedCount", 1] } } } },
  ]);
  return rows[0]?.total || 0;
};

// Helper: compute progress stats for a location (count-based)
export const buildStats = async (loc) => {
  const planned = {
    camera: loc.cameraConfig?.noOfCameras || 0,
    wifi: loc.wifiConfig?.noOfWifi || 0,
    power: loc.powerConfig?.noOfPower || 0,
  };

  const [cv, wv, pv, cp, wp, pp, cr, wr, pr] = await Promise.all([
    verifiedUnits(loc._id, "camera"),
    verifiedUnits(loc._id, "wifi"),
    verifiedUnits(loc._id, "power"),
    Update.countDocuments({ location: loc._id, type: "camera", status: "pending" }),
    Update.countDocuments({ location: loc._id, type: "wifi", status: "pending" }),
    Update.countDocuments({ location: loc._id, type: "power", status: "pending" }),
    Update.countDocuments({ location: loc._id, type: "camera", status: "rejected" }),
    Update.countDocuments({ location: loc._id, type: "wifi", status: "rejected" }),
    Update.countDocuments({ location: loc._id, type: "power", status: "rejected" }),
  ]);

  const pct = (v, p) => (p > 0 ? Math.min(100, Math.round((v / p) * 100)) : 0);

  return {
    planned,
    camera: {
      verified: cv,
      pending: cp,
      rejected: cr,
      progress: pct(cv, planned.camera),
      full: planned.camera > 0 && cv >= planned.camera,
    },
    wifi: {
      verified: wv,
      pending: wp,
      rejected: wr,
      progress: pct(wv, planned.wifi),
      full: planned.wifi > 0 && wv >= planned.wifi,
    },
    power: {
      verified: pv,
      pending: pp,
      rejected: pr,
      progress: pct(pv, planned.power),
      full: planned.power > 0 && pv >= planned.power,
    },
  };
};

export const createLocation = async (req, res) => {
  try {
    const {
      name,
      thana,
      district,
      latitude,
      longitude,
      noOfCameras,
      noOfWifi,
      noOfPower,
      superadminId,
      alertPhones,
    } = req.body;
    const creator = req.user;

    let assignedSuperadmin;

    if (creator.role === "company") {
      if (!superadminId)
        return res.status(400).json({ message: "superadminId required" });
      const sa = await User.findById(superadminId);
      if (!sa || sa.role !== "superadmin")
        return res.status(400).json({ message: "Invalid superadmin" });
      assignedSuperadmin = superadminId;
    } else if (creator.role === "superadmin") {
      assignedSuperadmin = creator._id;
    } else {
      // admin / recce — goes under their superadmin
      if (!creator.superadminId)
        return res
          .status(400)
          .json({ message: "You are not assigned to a superadmin" });
      assignedSuperadmin = creator.superadminId;
    }

    const locData = {
      name,
      thana,
      district,
      latitude,
      longitude,
      superadmin: assignedSuperadmin,
      createdBy: creator._id,
      alertPhones: Array.isArray(alertPhones)
        ? alertPhones
            .map((p) => String(p).replace(/[^\d]/g, ""))
            .filter(Boolean)
        : [],
    };

    // company / superadmin / admin can set the equipment counts
    const canSetAll = ["company", "superadmin", "admin"].includes(creator.role);
    if (canSetAll) {
      locData.cameraConfig = {
        noOfCameras: noOfCameras || 0,
        setBy: creator._id,
        setAt: new Date(),
      };
      locData.wifiConfig = {
        noOfWifi: noOfWifi || 0,
        setBy: creator._id,
        setAt: new Date(),
      };
      locData.powerConfig = {
        noOfPower: noOfPower || 0,
        setBy: creator._id,
        setAt: new Date(),
      };
    }

    const location = await Location.create(locData);
    await location.populate("superadmin", "name email");
    res.status(201).json(location);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getLocations = async (req, res) => {
  try {
    const { superadminId } = req.query;
    let filter = { isActive: true };

    if (req.user.role === "superadmin") {
      filter.superadmin = req.user._id;
    } else if (req.user.role === "company") {
      if (superadminId) filter.superadmin = superadminId;
    } else {
      // operator (admin/recce) — see locations under their superadmin
      filter.superadmin = req.user.superadminId;
    }

    const locations = await Location.find(filter)
      .populate("superadmin", "name email")
      .populate("createdBy", "name role")
      .sort("name");

    const result = await Promise.all(
      locations.map(async (loc) => ({
        ...loc.toObject(),
        stats: await buildStats(loc),
      })),
    );

    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getYamunaLocations = async (req, res) => {
  try {
    const superadminUser = await User.findOne({
      email: "yamunanagar@supertech.com",
      role: "superadmin",
    });

    if (!superadminUser) {
      return res.status(404).json({ message: "Superadmin not found" });
    }

    const locations = await Location.find({ superadmin: superadminUser._id })
      .populate("superadmin", "name email")
      .populate("createdBy", "name role")
      .sort("name");

    const result = await Promise.all(
      locations.map(async (loc) => ({
        ...loc.toObject(),
        stats: await buildStats(loc),
      })),
    );

    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getLocation = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id)
      .populate("superadmin", "name email")
      .populate("createdBy", "name role")
      .populate("cameraConfig.setBy", "name")
      .populate("wifiConfig.setBy", "name")
      .populate("powerConfig.setBy", "name");
    if (!location)
      return res.status(404).json({ message: "Location not found" });
    const stats = await buildStats(location);
    res.json({ ...location.toObject(), stats });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const updateLocation = async (req, res) => {
  try {
    const {
      name,
      thana,
      district,
      latitude,
      longitude,
      noOfCameras,
      noOfWifi,
      noOfPower,
    } = req.body;
    const loc = await Location.findById(req.params.id);
    if (!loc) return res.status(404).json({ message: "Location not found" });

    if (name) loc.name = name;
    if (thana) loc.thana = thana;
    if (district) loc.district = district;
    if (latitude) loc.latitude = latitude;
    if (longitude) loc.longitude = longitude;

    if (
      req.body.alertPhones !== undefined &&
      ["company", "superadmin"].includes(req.user.role)
    ) {
      const arr = Array.isArray(req.body.alertPhones)
        ? req.body.alertPhones
        : [];
      loc.alertPhones = arr
        .map((p) => String(p).replace(/[^\d]/g, ""))
        .filter(Boolean);
    }

    const r = req.user.role;
    const canConfigure = ["company", "superadmin", "admin"].includes(r);
    if (canConfigure && noOfCameras !== undefined)
      loc.cameraConfig = { noOfCameras, setBy: req.user._id, setAt: new Date() };
    if (canConfigure && noOfWifi !== undefined)
      loc.wifiConfig = { noOfWifi, setBy: req.user._id, setAt: new Date() };
    if (canConfigure && noOfPower !== undefined)
      loc.powerConfig = { noOfPower, setBy: req.user._id, setAt: new Date() };

    await loc.save();
    res.json(loc);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const deleteLocation = async (req, res) => {
  try {
    if (!["company", "superadmin"].includes(req.user.role))
      return res.status(403).json({ message: "Forbidden" });
    await Location.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: "Location deactivated" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─── NVR / WIFI credential rows (company + admin) ───
// Single fixed NVR row + single fixed WIFI row per location.
const canManageEquipment = (user, loc) => {
  if (user.role === "company") return true;
  if (user.role === "admin")
    return user.superadminId?.toString() === loc.superadmin?.toString();
  return false;
};

// Read both credential rows (company + admin only)
export const getEquipment = async (req, res) => {
  try {
    const loc = await Location.findById(req.params.id).select(
      "nvr wifi superadmin",
    );
    if (!loc) return res.status(404).json({ message: "Location not found" });
    if (!["company", "admin"].includes(req.user.role))
      return res.status(403).json({ message: "Forbidden" });
    res.json({
      nvr: loc.nvr || { ipAddress: "", password: "", remark: "" },
      wifi: loc.wifi || { name: "", password: "", remark: "" },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Update one or both credential rows. Body may include `nvr` and/or `wifi` objects.
export const updateEquipment = async (req, res) => {
  try {
    const loc = await Location.findById(req.params.id);
    if (!loc) return res.status(404).json({ message: "Location not found" });
    if (!canManageEquipment(req.user, loc))
      return res.status(403).json({ message: "Forbidden" });

    const now = new Date();

    if (req.body.nvr && typeof req.body.nvr === "object") {
      const n = req.body.nvr;
      loc.nvr = {
        ipAddress: (n.ipAddress ?? loc.nvr?.ipAddress ?? "").toString().trim(),
        password: (n.password ?? loc.nvr?.password ?? "").toString().trim(),
        remark: (n.remark ?? loc.nvr?.remark ?? "").toString().trim(),
        updatedBy: req.user._id,
        updatedAt: now,
      };
    }

    if (req.body.wifi && typeof req.body.wifi === "object") {
      const w = req.body.wifi;
      loc.wifi = {
        name: (w.name ?? loc.wifi?.name ?? "").toString().trim(),
        password: (w.password ?? loc.wifi?.password ?? "").toString().trim(),
        remark: (w.remark ?? loc.wifi?.remark ?? "").toString().trim(),
        updatedBy: req.user._id,
        updatedAt: now,
      };
    }

    await loc.save();
    res.json({ nvr: loc.nvr, wifi: loc.wifi });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const bulkUploadLocations = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Excel file required" });
    }

    const XLSX = await import("xlsx");
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: "",
    });

    if (!rows.length) {
      return res.status(400).json({ message: "Excel file is empty" });
    }

    const allSuperadmins = await User.find({
      role: "superadmin",
      isActive: true,
    });

    const created = [];
    const failed = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const rowNum = i + 2;

      const r = {};
      Object.keys(raw).forEach((k) => {
        r[k.toLowerCase().replace(/\s+/g, "")] = String(raw[k]).trim();
      });

      const name = r["name"] || "";
      const thana = r["thana"] || "";

      if (!name || !thana) {
        failed.push({ row: rowNum, reason: "name aur thana compulsory hain" });
        continue;
      }

      const saEmail = r["superadminemail"] || r["email"] || "";
      const saName = r["superadminname"] || r["superadmin"] || "";

      let superadmin = null;
      if (saEmail) {
        superadmin = allSuperadmins.find(
          (s) => s.email.toLowerCase() === saEmail.toLowerCase(),
        );
      } else if (saName) {
        superadmin = allSuperadmins.find(
          (s) => s.name.toLowerCase() === saName.toLowerCase(),
        );
      }

      if (!superadmin) {
        failed.push({
          row: rowNum,
          name,
          reason: `SuperAdmin nahi mila (email: "${saEmail}" / name: "${saName}")`,
        });
        continue;
      }

      const toNum = (v) => {
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
      };

      try {
        const loc = await Location.create({
          name,
          thana,
          district: r["district"] || "",
          latitude: toNum(r["latitude"]),
          longitude: toNum(r["longitude"]),
          superadmin: superadmin._id,
          createdBy: req.user._id,
          cameraConfig: {
            noOfCameras: toNum(r["noofcameras"] || r["cameras"] || 0),
            setBy: req.user._id,
            setAt: new Date(),
          },
          wifiConfig: {
            noOfWifi: toNum(r["noofwifi"] || r["wifi"] || 0),
            setBy: req.user._id,
            setAt: new Date(),
          },
          powerConfig: {
            noOfPower: toNum(
              r["noofpower"] || r["power"] || r["powersupply"] || r["noofpowersupply"] || 0,
            ),
            setBy: req.user._id,
            setAt: new Date(),
          },
        });
        created.push(loc.name);
      } catch (e) {
        failed.push({ row: rowNum, name, reason: e.message });
      }
    }

    res.json({
      message: `${created.length} locations add hui, ${failed.length} fail hui`,
      created: created.length,
      failed,
    });
  } catch (e) {
    console.error("Bulk upload error:", e);
    res.status(500).json({ message: e.message });
  }
};

export const getProgressStats = async (req, res) => {
  try {
    let filter = { isActive: true };
    if (req.user.role === "superadmin") filter.superadmin = req.user._id;
    else if (!["company"].includes(req.user.role))
      filter.superadmin = req.user.superadminId;

    const locations = await Location.find(filter);

    let totalPlanned = { camera: 0, wifi: 0, power: 0 };
    locations.forEach((loc) => {
      totalPlanned.camera += loc.cameraConfig?.noOfCameras || 0;
      totalPlanned.wifi += loc.wifiConfig?.noOfWifi || 0;
      totalPlanned.power += loc.powerConfig?.noOfPower || 0;
    });

    const saMatch = filter.superadmin
      ? { superadmin: new mongoose.Types.ObjectId(String(filter.superadmin)) }
      : {};

    const sumVerified = async (type) => {
      const rows = await Update.aggregate([
        { $match: { type, status: "verified", ...saMatch } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$installedCount", 1] } } } },
      ]);
      return rows[0]?.total || 0;
    };

    const [cv, wv, pv, cp, wp, pp, cr, wr, pr] = await Promise.all([
      sumVerified("camera"),
      sumVerified("wifi"),
      sumVerified("power"),
      Update.countDocuments({ type: "camera", status: "pending", ...saMatch }),
      Update.countDocuments({ type: "wifi", status: "pending", ...saMatch }),
      Update.countDocuments({ type: "power", status: "pending", ...saMatch }),
      Update.countDocuments({ type: "camera", status: "rejected", ...saMatch }),
      Update.countDocuments({ type: "wifi", status: "rejected", ...saMatch }),
      Update.countDocuments({ type: "power", status: "rejected", ...saMatch }),
    ]);

    const pct = (v, p) => (p > 0 ? Math.min(100, Math.round((v / p) * 100)) : 0);

    res.json({
      totalLocations: locations.length,
      totalPlanned,
      camera: { verified: cv, pending: cp, rejected: cr, progress: pct(cv, totalPlanned.camera) },
      wifi: { verified: wv, pending: wp, rejected: wr, progress: pct(wv, totalPlanned.wifi) },
      power: { verified: pv, pending: pp, rejected: pr, progress: pct(pv, totalPlanned.power) },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─── RECCE: Update lat/long and/or default image for a location ───
export const updateRecceData = async (req, res) => {
  try {
    const loc = await Location.findById(req.params.id);
    if (!loc) return res.status(404).json({ message: "Location not found" });

    const {
      latitude,
      longitude,
      updatedByName,
      updatedByPhone,
      updatedByDescription,
    } = req.body;

    if (!updatedByName || !updatedByPhone) {
      return res
        .status(400)
        .json({ message: "updatedByName and updatedByPhone are required" });
    }

    if (latitude !== undefined && latitude !== "")
      loc.latitude = parseFloat(latitude);
    if (longitude !== undefined && longitude !== "")
      loc.longitude = parseFloat(longitude);

    loc.updatedByName = updatedByName.trim();
    loc.updatedByPhone = updatedByPhone.trim();
    loc.updatedByDescription = updatedByDescription?.trim() || "";

    if (req.files && req.files.length > 0) {
      const cloudinary = (await import("../config/cloudinary.js")).default;
      const uploadPromises = req.files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "fieldops/recce", resource_type: "image" },
              (err, result) => (err ? reject(err) : resolve(result.secure_url)),
            );
            stream.end(file.buffer);
          }),
      );
      const newUrls = await Promise.all(uploadPromises);
      const keepImages = req.body.keepImages
        ? Array.isArray(req.body.keepImages)
          ? req.body.keepImages
          : [req.body.keepImages]
        : [];
      loc.defaultImages = [...keepImages, ...newUrls];
      loc.defaultImageSetAt = new Date();
    } else {
      const keepImages = req.body.keepImages
        ? Array.isArray(req.body.keepImages)
          ? req.body.keepImages
          : [req.body.keepImages]
        : loc.defaultImages;
      loc.defaultImages = keepImages;
    }

    await loc.save();
    res.json(loc);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
// ─── LOCATION REMARKS (company only) ────────────────────────────────────────

// POST /locations/:id/remarks — add a remark
export const addLocationRemark = async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ message: 'Only company can add remarks' });
    }
    const { text, color } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'Remark text is required' });
    if (!['green', 'yellow', 'red'].includes(color)) {
      return res.status(400).json({ message: 'Color must be green, yellow, or red' });
    }
    const loc = await Location.findById(req.params.id);
    if (!loc) return res.status(404).json({ message: 'Location not found' });

    loc.remarks.push({ text: text.trim(), color, createdBy: req.user._id, createdAt: new Date() });
    await loc.save();
    res.json({ remarks: loc.remarks });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// DELETE /locations/:id/remarks/:remarkId — delete a remark
export const deleteLocationRemark = async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ message: 'Only company can delete remarks' });
    }
    const loc = await Location.findById(req.params.id);
    if (!loc) return res.status(404).json({ message: 'Location not found' });

    const before = loc.remarks.length;
    loc.remarks = loc.remarks.filter(r => r._id.toString() !== req.params.remarkId);
    if (loc.remarks.length === before) {
      return res.status(404).json({ message: 'Remark not found' });
    }
    await loc.save();
    res.json({ remarks: loc.remarks });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
// ─── CONTROL ROOM ─────────────────────────────────────────────────────────────
//
// Flow:
//   1. admin (ground) → POST /:id/control-room/request   — raises a connection request
//   2. superadmin     → POST /:id/control-room/review    — body: { action: 'accept' | 'reject', reason }
//   3. If rejected, admin can POST /:id/control-room/request again (re-request)
//   4. GET /:id/control-room/trail — full audit trail for the location
//
// Visibility rules:
//   - admin can request / re-request
//   - superadmin can accept / reject (only for locations under them)
//   - company, superadmin, admin can read the trail

// POST /locations/:id/control-room/request
export const requestControlRoom = async (req, res) => {
  try {
    const loc = await Location.findById(req.params.id);
    if (!loc) return res.status(404).json({ message: "Location not found" });

    // Only admin role can raise the request
    if (!["admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only admin (ground) can request control room connection" });
    }

    // Must belong to same superadmin
    if (loc.superadmin.toString() !== req.user.superadminId?.toString()) {
      return res.status(403).json({ message: "Not authorized for this location" });
    }

    // Determine action label
    const isReRequest = loc.controlRoom?.status === "rejected";
    const action = isReRequest ? "re-requested" : "requested";

    // Update controlRoom status
    if (!loc.controlRoom) loc.controlRoom = {};
    loc.controlRoom.status = "pending";
    loc.controlRoom.requestedBy = req.user._id;
    loc.controlRoom.requestedAt = new Date();
    loc.controlRoom.rejectReason = "";

    // Append trail
    if (!loc.controlRoom.trail) loc.controlRoom.trail = [];
    loc.controlRoom.trail.push({
      action,
      by: req.user._id,
      byName: req.user.name,
      byRole: req.user.role,
      reason: "",
      at: new Date(),
    });

    loc.markModified("controlRoom");
    await loc.save();

    // Notify the superadmin of this location
    try {
      const io = req.app?.get("io");
      await notifySuperadmin(io, loc.superadmin.toString(), {
        sender: req.user._id,
        type: "control_room_request",
        title: `Control Room ${action === "re-requested" ? "Re-Request" : "Request"} — ${loc.name}`,
        message: `${req.user.name} ne control room connection ki request ki hai (${loc.thana}${loc.district ? ", " + loc.district : ""})`,
        location: loc._id,
      });
    } catch (_) { /* notification failure should not break the flow */ }

    res.json({ controlRoom: loc.controlRoom, message: `Control room ${action} successfully` });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// POST /locations/:id/control-room/review
// Body: { action: 'accept' | 'reject', reason?: string }
export const reviewControlRoom = async (req, res) => {
  try {
    const loc = await Location.findById(req.params.id);
    if (!loc) return res.status(404).json({ message: "Location not found" });

    // Only superadmin can review, and only for their own locations
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Only superadmin can accept/reject control room requests" });
    }
    if (loc.superadmin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized for this location" });
    }

    // Must be in pending state to review
    if (loc.controlRoom?.status !== "pending") {
      return res.status(400).json({ message: "No pending control room request for this location" });
    }

    const { action, reason } = req.body;
    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({ message: "action must be 'accept' or 'reject'" });
    }

    if (action === "reject" && !reason?.trim()) {
      return res.status(400).json({ message: "Reason is required when rejecting" });
    }

    const now = new Date();
    loc.controlRoom.reviewedBy = req.user._id;
    loc.controlRoom.reviewedAt = now;

    if (action === "accept") {
      loc.controlRoom.status = "connected";
      loc.controlRoom.rejectReason = "";
    } else {
      loc.controlRoom.status = "rejected";
      loc.controlRoom.rejectReason = reason.trim();
    }

    // Append trail
    loc.controlRoom.trail.push({
      action: action === "accept" ? "accepted" : "rejected",
      by: req.user._id,
      byName: req.user.name,
      byRole: req.user.role,
      reason: action === "reject" ? reason.trim() : "",
      at: now,
    });

    loc.markModified("controlRoom");
    await loc.save();

    // Notify the admin who raised the request
    if (loc.controlRoom.requestedBy) {
      try {
        const io = req.app?.get("io");
        const notifType = action === "accept" ? "control_room_accepted" : "control_room_rejected";
        await createNotification(io, {
          recipient: loc.controlRoom.requestedBy,
          sender: req.user._id,
          type: notifType,
          title: action === "accept"
            ? `Control Room Connected — ${loc.name}`
            : `Control Room Request Rejected — ${loc.name}`,
          message: action === "accept"
            ? `Superadmin ne ${loc.name} ki control room request accept kar li`
            : `Superadmin ne ${loc.name} ki control room request reject kar di. Reason: ${reason.trim()}`,
          location: loc._id,
        });
      } catch (_) { /* ignore */ }
    }

    res.json({ controlRoom: loc.controlRoom, message: `Control room ${action}ed successfully` });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// GET /locations/:id/control-room/trail
export const getControlRoomTrail = async (req, res) => {
  try {
    const loc = await Location.findById(req.params.id)
      .select("controlRoom superadmin")
      .populate("controlRoom.trail.by", "name role");

    if (!loc) return res.status(404).json({ message: "Location not found" });

    // company, superadmin (own), admin (own) can read
    const user = req.user;
    if (user.role === "superadmin" && loc.superadmin.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (["admin", "recce"].includes(user.role) && loc.superadmin.toString() !== user.superadminId?.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json({ controlRoom: loc.controlRoom });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// GET /locations/control-room/pending  — superadmin: list all their pending requests
export const getPendingControlRoomRequests = async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Only superadmin can view pending requests" });
    }

    const locations = await Location.find({
      superadmin: req.user._id,
      isActive: true,
      "controlRoom.status": "pending",
    })
      .select("name thana district controlRoom")
      .populate("controlRoom.requestedBy", "name role");

    res.json(locations);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};