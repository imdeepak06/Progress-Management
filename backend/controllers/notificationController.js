import Notification from '../models/Notification.js';

export const getNotifications = async (req, res) => {
  try {
    const notifs = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'name role')
      .populate('location', 'name thana')
      .sort('-createdAt')
      .limit(60);
    res.json(notifs);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    res.json({ count });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const markRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true, readAt: new Date() }
    );
    res.json({ message: 'Marked as read' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
    res.json({ message: 'All read' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
