const db = require('../config/db');

// Cria um negócio pertencente ao usuário logado (que precisa ter papel 'admin').
async function criar(req, res) {
  const { nome, horario_funcionamento } = req.body;

  if (!nome) {
    return res.status(400).json({ erro: 'nome é obrigatório.' });
  }

  const resultado = await db.query(
    `INSERT INTO negocios (dono_id, nome, horario_funcionamento)
     VALUES ($1, $2, $3)
     RETURNING id, nome, horario_funcionamento, criado_em`,
    [req.usuario.id, nome, horario_funcionamento || null]
  );

  return res.status(201).json({ negocio: resultado.rows[0] });
}

// Lista os negócios pertencentes ao usuário logado.
async function listarMeus(req, res) {
  const resultado = await db.query(
    'SELECT id, nome, horario_funcionamento, criado_em FROM negocios WHERE dono_id = $1 ORDER BY criado_em DESC',
    [req.usuario.id]
  );

  return res.json({ negocios: resultado.rows });
}

// Retorna os detalhes públicos de um negócio (qualquer pessoa pode ver, sem login).
async function buscarPorId(req, res) {
  const resultado = await db.query(
    'SELECT id, nome, horario_funcionamento, criado_em FROM negocios WHERE id = $1',
    [req.params.id]
  );

  if (resultado.rows.length === 0) {
    return res.status(404).json({ erro: 'Negócio não encontrado.' });
  }

  return res.json({ negocio: resultado.rows[0] });
}

// Atualiza nome e/ou horário de funcionamento. Só o dono pode (garantido pelo middleware).
async function atualizar(req, res) {
  const { nome, horario_funcionamento } = req.body;

  const resultado = await db.query(
    `UPDATE negocios
     SET nome = COALESCE($1, nome),
         horario_funcionamento = COALESCE($2, horario_funcionamento)
     WHERE id = $3
     RETURNING id, nome, horario_funcionamento, criado_em`,
    [nome || null, horario_funcionamento || null, req.params.id]
  );

  return res.json({ negocio: resultado.rows[0] });
}

module.exports = { criar, listarMeus, buscarPorId, atualizar };
