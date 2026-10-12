const { getRedis } = require('../../lib/db');
const { requireAdmin, publicUser, methodNotAllowed, serverError } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res);
  try {
    res.setHeader('Cache-Control', 'no-store');
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const r = getRedis();
    const ids = await r.smembers('users');
    const users = (await Promise.all(ids.map((id) => r.get('user:' + id)))).filter(Boolean);
    const counts = await Promise.all(users.map((u) => r.llen('orders:' + u.id)));
    const list = users
      .map((u, i) => ({ ...publicUser(u), orders: counts[i] || 0 }))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

    return res.status(200).json({ users: list });
  } catch (e) {
    return serverError(res, e);
  }
};
