const bcrypt = require('bcryptjs');
const { getRedis } = require('../../lib/db');
const {
  requireAdmin, publicUser, checkNick, checkEmail, checkPassword, methodNotAllowed, serverError,
} = require('../../lib/auth');

module.exports = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const id = String((req.query && req.query.id) || '');
    if (!id) return res.status(400).json({ error: 'Informe o id do usuário.' });

    const r = getRedis();
    const user = await r.get('user:' + id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    if (req.method === 'GET') {
      const orders = await r.lrange('orders:' + id, 0, -1);
      return res.status(200).json({ user: publicUser(user), orders: orders.reverse() });
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      const nick = String(body.nick || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = typeof body.password === 'string' ? body.password : '';

      const err = checkNick(nick, user.role === 'admin') || checkEmail(email) || (password ? checkPassword(password) : null);
      if (err) return res.status(400).json({ error: err });

      const emailOwner = await r.get('email:' + email);
      if (emailOwner && emailOwner !== id) return res.status(409).json({ error: 'Esse email já está em uso por outra conta.' });
      const nickOwner = await r.get('nick:' + nick.toLowerCase());
      if (nickOwner && nickOwner !== id) return res.status(409).json({ error: 'Esse nick já está em uso por outra conta.' });

      if (email !== user.email) {
        await r.del('email:' + user.email);
        await r.set('email:' + email, id);
      }
      if (nick.toLowerCase() !== user.nick.toLowerCase()) {
        await r.del('nick:' + user.nick.toLowerCase());
        await r.set('nick:' + nick.toLowerCase(), id);
      }

      user.nick = nick;
      user.email = email;
      if (password) {
        user.hash = await bcrypt.hash(password, 10);
        user.tv = (user.tv || 0) + 1; // derruba as sessões abertas dessa conta
      }
      await r.set('user:' + id, user);

      // Se o admin trocou a própria senha, mantém ele logado com a nova sessão
      if (password && id === admin.id) {
        const { setSession } = require('../../lib/auth');
        setSession(res, user);
      }
      return res.status(200).json({ user: publicUser(user) });
    }

    if (req.method === 'DELETE') {
      if (user.role === 'admin') return res.status(400).json({ error: 'A conta admin não pode ser excluída.' });
      await r.del('user:' + id, 'email:' + user.email, 'nick:' + user.nick.toLowerCase(), 'orders:' + id);
      await r.srem('users', id);
      return res.status(200).json({ ok: true });
    }

    return methodNotAllowed(res);
  } catch (e) {
    return serverError(res, e);
  }
};
