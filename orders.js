const { getRedis } = require('../lib/db');
const { PRODUCTS, COUPONS } = require('../lib/catalog');
const { newId, requireUser, methodNotAllowed, serverError } = require('../lib/auth');

module.exports = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const user = await requireUser(req, res);
    if (!user) return;
    const r = getRedis();

    if (req.method === 'GET') {
      const orders = await r.lrange('orders:' + user.id, 0, -1);
      return res.status(200).json({ orders: orders.reverse() });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const ids = Array.isArray(body.items) ? body.items : [];
      if (ids.length === 0 || ids.length > 50) return res.status(400).json({ error: 'Carrinho inválido.' });

      const items = [];
      let subtotal = 0;
      for (const id of ids) {
        const p = PRODUCTS[String(id)];
        if (!p) return res.status(400).json({ error: 'Produto inválido no carrinho.' });
        items.push(p.name);
        subtotal += p.price;
      }

      let total;
      let status;
      if (user.role === 'admin') {
        total = 0;
        status = 'Concluído (admin, sem custo)';
      } else {
        const code = String(body.coupon || '').trim().toUpperCase();
        const discount = Object.prototype.hasOwnProperty.call(COUPONS, code) ? COUPONS[code] : 0;
        total = Math.round(subtotal * (1 - discount) * 100) / 100;
        status = total === 0 ? 'Cupom 100% (aguardando ativação)' : 'Aguardando comprovante';
      }

      const order = { id: newId('o'), uid: user.id, items, total, date: new Date().toISOString(), status };
      await r.rpush('orders:' + user.id, order);
      return res.status(201).json({ order });
    }

    return methodNotAllowed(res);
  } catch (e) {
    return serverError(res, e);
  }
};
