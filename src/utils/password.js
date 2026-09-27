const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

function hashSenha(senhaPura) {
  return bcrypt.hash(senhaPura, SALT_ROUNDS);
}

function compararSenha(senhaPura, senhaHash) {
  return bcrypt.compare(senhaPura, senhaHash);
}

module.exports = { hashSenha, compararSenha };
