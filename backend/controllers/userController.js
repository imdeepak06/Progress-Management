import User from '../models/User.js';

export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, superadminId, alertPhones } = req.body;
    const creator = req.user;

    // Only company can create users
    if (creator.role !== 'company') {
      return res.status(403).json({ message: 'Only company can create users' });
    }

    const allowed = ['superadmin', 'admin', 'recce', 'queryAdmin'];
    if (!allowed.includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Allowed: superadmin, admin, recce, queryAdmin' });
    }

    // For operators (admin/recce), superadminId is required
    if (['admin', 'recce'].includes(role) && !superadminId) {
      return res.status(400).json({ message: 'superadminId required for operator roles' });
    }

    if (superadminId) {
      const sa = await User.findById(superadminId);
      if (!sa || sa.role !== 'superadmin') {
        return res.status(400).json({ message: 'Invalid superadmin' });
      }
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({
      name, email, password, role,
      superadminId: ['admin', 'recce'].includes(role) ? superadminId : null,
      createdBy: creator._id,
      alertPhones: Array.isArray(alertPhones)
        ? alertPhones.map(p => String(p).replace(/[^\d]/g, '')).filter(Boolean)
        : [],
    });

    res.status(201).json(user);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const getUsers = async (req, res) => {
  try {
    const { role, superadminId } = req.query;
    let filter = {};
    if (role) filter.role = role;
    if (superadminId) filter.superadminId = superadminId;

    if (req.user.role === 'superadmin') {
      filter.superadminId = req.user._id;
    }

    const users = await User.find(filter)
      .populate('superadminId', 'name email')
      .populate('createdBy', 'name')
      .sort('-createdAt');

    res.json(users);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const getSuperadmins = async (req, res) => {
  try {
    const superadmins = await User.find({ role: 'superadmin', isActive: true })
      .select('name email createdAt alertPhones')
      .sort('name');
    res.json(superadmins);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const updateUser = async (req, res) => {
  try {
    if (req.user.role !== 'company') return res.status(403).json({ message: 'Forbidden' });
    const { name, email, isActive, superadminId, alertPhones } = req.body;
    const update = { name, email, isActive, ...(superadminId && { superadminId }) };
    if (alertPhones !== undefined) {
      update.alertPhones = (Array.isArray(alertPhones) ? alertPhones : [])
        .map(p => String(p).replace(/[^\d]/g, '')).filter(Boolean);
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// Self-service: superadmin or company manages their OWN alert phone numbers
export const updateMyAlertPhones = async (req, res) => {
  try {
    if (!['company', 'superadmin'].includes(req.user.role))
      return res.status(403).json({ message: 'Forbidden' });
    const arr = Array.isArray(req.body.alertPhones) ? req.body.alertPhones : [];
    const cleaned = arr.map(p => String(p).replace(/[^\d]/g, '')).filter(Boolean);
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { alertPhones: cleaned },
      { new: true }
    );
    res.json({ alertPhones: user.alertPhones });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const deleteUser = async (req, res) => {
  try {
    if (req.user.role !== 'company') return res.status(403).json({ message: 'Forbidden' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

export const getSuperadminNames = async (req, res) => {
  try {
    const superadmins = await User.find({
      role: 'superadmin',
      isActive: true,
    })
      .select('_id name')
      .sort('name');

    res.json(superadmins);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};