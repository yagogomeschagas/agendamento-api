const db = require('../config/db');

// Busca o negócio pelo :id da URL e garante que o usuário logado é o dono dele.
// Anexa o negócio encontrado em req.negocio para os controllers reaproveitarem.
async function verificarDonoDoNegocio(req, res, next) {
  try {
    const negocioId = req.params.id;

    const resultado = await db.query('SELECT * FROM negocios WHERE id = $1', [negocioId]);
    const negocio = resultado.rows[0];

    if (!negocio) {
      return res.status(404).json({ erro: 'Negócio não encontrado.' });
    }

    if (negocio.dono_id !== Number(req.usuario.id)) {
      return res.status(403).json({ erro: 'Você não é o dono deste negócio.' });
    }

    req.negocio = negocio;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { verificarDonoDoNegocio };
