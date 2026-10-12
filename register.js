const bcrypt = require('bcryptjs');
const { getRedis } = require('../lib/db');
const {
  newId, setSession, publicUser, rateLimit, clientIp,
  checkNick, checkEmail, checkPassword, methodNotAllowed, serverError,
} = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res);
  try {
    const body = req.body || {};
    const nick = String(body.nick || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';

    const err = checkNick(nick, false) || checkEmail(email) || checkPassword(password);
    if (err) return res.status(400).json({ error: err });

    if (!(await rateLimit('rl:reg:' + clientIp(req), 20, 3600))) {
      return res.status(429).json({ error: 'Muitas tentativas. Tente de novo mais tarde.' });
    }

    const r = getRedis();
    if (await r.get('email:' + email)) return res.status(409).json({ error: 'Esse email já está cadastrado.' });
    if (await r.get('nick:' + nick.toLowerCase())) return res.status(409).json({ error: 'Esse nick já está em uso.' });

    const user = {
      id: newId('u'), nick, email, hash: await bcrypt.hash(password, 10),
      role: 'user', tv: 0, createdAt: new Date().toISOString(),
    };
    await r.set('user:' + user.id, user);
    await r.set('email:' + email, user.id);
    await r.set('nick:' + nick.toLowerCase(), user.id);
    await r.sadd('users', user.id);

    setSession(res, user);
    return res.status(201).json({ user: publicUser(user) });
  } catch (e) {
    return serverError(res, e);
  }
};
