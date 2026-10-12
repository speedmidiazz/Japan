const { getUser, publicUser, methodNotAllowed, serverError } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res);
  try {
    res.setHeader('Cache-Control', 'no-store');
    const user = await getUser(req);
    return res.status(200).json({ user: user ? publicUser(user) : null });
  } catch (e) {
    return serverError(res, e);
  }
};
