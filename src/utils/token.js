const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function gerarAccessToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, papel: usuario.papel },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

function verificarAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

// O refresh token em si é opaco (random), não um JWT.
// Guardamos só o HASH dele no banco: se o banco vazar, os tokens não são reutilizáveis.
function gerarRefreshTokenOpaco() {
  return crypto.randomBytes(48).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  gerarAccessToken,
  verificarAccessToken,
  gerarRefreshTokenOpaco,
  hashToken,
};
