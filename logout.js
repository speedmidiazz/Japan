const { clearSession, methodNotAllowed } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res);
  clearSession(res);
  return res.status(200).json({ ok: true });
};
