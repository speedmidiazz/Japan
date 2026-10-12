const { getRedis } = require('../lib/db');

// Abra /api/health no seu site para ver o que falta configurar. Não mostra nenhum segredo.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const out = {
    jwtSecret: !!(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16),
    adminEmail: !!process.env.ADMIN_EMAIL,
    adminPassword: !!process.env.ADMIN_PASSWORD,
    database: false,
    dicas: [],
  };

  try {
    const r = getRedis();
    await r.set('health:ping', 1);
    out.database = Number(await r.get('health:ping')) === 1;
  } catch (e) {
    out.dicas.push('Banco de dados não conectado: na Vercel, abra Storage, crie o Upstash Redis e conecte ao projeto.');
  }

  if (!out.jwtSecret) out.dicas.push('Falta a variável JWT_SECRET (texto aleatório com 16+ caracteres).');
  if (!out.adminEmail) out.dicas.push('Falta a variável ADMIN_EMAIL.');
  if (!out.adminPassword) out.dicas.push('Falta a variável ADMIN_PASSWORD.');
  if (out.dicas.length) out.dicas.push('Depois de mudar variáveis ou conectar o banco, faça um Redeploy.');

  out.ok = out.database && out.jwtSecret && out.adminEmail && out.adminPassword;
  return res.status(out.ok ? 200 : 503).json(out);
};
