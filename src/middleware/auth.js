const { verificarAccessToken } = require('../utils/token');

// Verifica se o access token enviado no header Authorization é válido.
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token de acesso ausente.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verificarAccessToken(token);
    req.usuario = { id: payload.sub, papel: payload.papel };
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token de acesso inválido ou expirado.' });
  }
}

// Restringe a rota a determinados papéis (ex: autorizar('admin', 'profissional')).
function autorizar(...papeisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !papeisPermitidos.includes(req.usuario.papel)) {
      return res.status(403).json({ erro: 'Você não tem permissão para acessar este recurso.' });
    }
    next();
  };
}

module.exports = { autenticar, autorizar };
