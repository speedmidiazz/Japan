const bcrypt = require('bcryptjs');
const { getRedis } = require('../lib/db');
const {
  setSession, publicUser, ensureAdmin, rateLimit, clientIp, methodNotAllowed, serverError,
} = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res);
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) return res.status(400).json({ error: 'Informe email e senha.' });

    // Máximo de 8 tentativas por IP + email a cada 15 minutos
    if (!(await rateLimit(`rl:login:${clientIp(req)}:${email}`, 8, 900))) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
    }

    await ensureAdmin();

    const r = getRedis();
    const id = await r.get('email:' + email);
    const user = id ? await r.get('user:' + id) : null;
    if (!user || !(await bcrypt.compare(password, user.hash))) {
      return res.status(401).json({ error: 'Email ou senha incorretos.' });
    }

    setSession(res, user);
    return res.status(200).json({ user: publicUser(user) });
  } catch (e) {
    return serverError(res, e);
  }
};
