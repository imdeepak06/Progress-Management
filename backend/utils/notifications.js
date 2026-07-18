import Notification from '../models/Notification.js';
import User from '../models/User.js';

export const createNotification = async (io, { recipient, sender, type, title, message, update, location }) => {
  try {
    const notif = await Notification.create({ recipient, sender, type, title, message, update, location });
    if (io) {
      io.to(recipient.toString()).emit('notification', {
        _id: notif._id, type, title, message, update, location,
        createdAt: notif.createdAt, isRead: false,
      });
    }
    return notif;
  } catch (e) { console.error('Notification error:', e.message); }
};

// Notify all company users
export const notifyCompany = async (io, payload) => {
  const companies = await User.find({ role: 'company', isActive: true });
  for (const c of companies) await createNotification(io, { ...payload, recipient: c._id });
};

// Notify all superadmins
export const notifyAllSuperadmins = async (io, payload) => {
  const admins = await User.find({ role: 'superadmin', isActive: true });
  for (const a of admins) await createNotification(io, { ...payload, recipient: a._id });
};

// Notify specific superadmin
export const notifySuperadmin = async (io, superadminId, payload) => {
  await createNotification(io, { ...payload, recipient: superadminId });
};
