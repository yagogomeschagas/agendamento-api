const db = require('../config/db');
const { hashSenha, compararSenha } = require('../utils/password');
const {
  gerarAccessToken,
  gerarRefreshTokenOpaco,
  hashToken,
} = require('../utils/token');

const REFRESH_EXPIRES_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7);

// Papéis que podem se auto-registrar publicamente.
// 'profissional' não entra aqui: profissionais são vinculados por um admin
// via POST /negocios/:id/profissionais, e não se cadastram sozinhos como tal.
const PAPEIS_PERMITIDOS_NO_REGISTRO = ['cliente', 'admin'];

async function registrar(req, res) {
  const { nome, email, senha, papel = 'cliente', telefone } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'nome, email e senha são obrigatórios.' });
  }

  if (!PAPEIS_PERMITIDOS_NO_REGISTRO.includes(papel)) {
    return res.status(400).json({ erro: `papel deve ser um de: ${PAPEIS_PERMITIDOS_NO_REGISTRO.join(', ')}` });
  }

  const existente = await db.query('SELECT id FROM usuarios WHERE email = $1', [email]);
  if (existente.rows.length > 0) {
    return res.status(409).json({ erro: 'Já existe um usuário com este email.' });
  }

  const senhaHash = await hashSenha(senha);

  const resultado = await db.query(
    `INSERT INTO usuarios (nome, email, senha_hash, papel, telefone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nome, email, papel, criado_em`,
    [nome, email, senhaHash, papel, telefone || null]
  );

  const usuario = resultado.rows[0];
  return res.status(201).json({ usuario });
}

async function login(req, res) {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'email e senha são obrigatórios.' });
  }

  const resultado = await db.query(
    'SELECT id, nome, email, senha_hash, papel FROM usuarios WHERE email = $1',
    [email]
  );
  const usuario = resultado.rows[0];

  // Mensagem genérica de propósito: não revelar se foi o email ou a senha que errou.
  if (!usuario || !(await compararSenha(senha, usuario.senha_hash))) {
    return res.status(401).json({ erro: 'Email ou senha inválidos.' });
  }

  const accessToken = gerarAccessToken(usuario);
  const refreshToken = gerarRefreshTokenOpaco();
  const expiraEm = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO refresh_tokens (usuario_id, token_hash, expira_em)
     VALUES ($1, $2, $3)`,
    [usuario.id, hashToken(refreshToken), expiraEm]
  );

  return res.json({
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
    accessToken,
    refreshToken,
  });
}

// Gera um novo access token (e rotaciona o refresh token) a partir de um refresh válido.
async function refresh(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ erro: 'refreshToken é obrigatório.' });
  }

  const tokenHash = hashToken(refreshToken);

  const resultado = await db.query(
    `SELECT rt.id, rt.usuario_id, rt.expira_em, rt.revogado, u.papel
     FROM refresh_tokens rt
     JOIN usuarios u ON u.id = rt.usuario_id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  );
  const registro = resultado.rows[0];

  if (!registro || registro.revogado || new Date(registro.expira_em) < new Date()) {
    return res.status(401).json({ erro: 'Refresh token inválido, expirado ou revogado.' });
  }

  // Rotação: revoga o token usado e emite um novo (mitiga replay de token roubado).
  await db.query('UPDATE refresh_tokens SET revogado = true WHERE id = $1', [registro.id]);

  const novoRefreshToken = gerarRefreshTokenOpaco();
  const novaExpiracao = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO refresh_tokens (usuario_id, token_hash, expira_em)
     VALUES ($1, $2, $3)`,
    [registro.usuario_id, hashToken(novoRefreshToken), novaExpiracao]
  );

  const novoAccessToken = gerarAccessToken({ id: registro.usuario_id, papel: registro.papel });

  return res.json({ accessToken: novoAccessToken, refreshToken: novoRefreshToken });
}

async function logout(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ erro: 'refreshToken é obrigatório.' });
  }

  await db.query(
    'UPDATE refresh_tokens SET revogado = true WHERE token_hash = $1',
    [hashToken(refreshToken)]
  );

  return res.status(204).send();
}

module.exports = { registrar, login, refresh, logout };
