const db = require('../config/db');

// Cria um serviço dentro do negócio (só o dono, via middleware de ownership).
async function criar(req, res) {
  const { nome, duracao_min, preco } = req.body;

  if (!nome || !duracao_min || preco === undefined) {
    return res.status(400).json({ erro: 'nome, duracao_min e preco são obrigatórios.' });
  }

  const resultado = await db.query(
    `INSERT INTO servicos (negocio_id, nome, duracao_min, preco)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nome, duracao_min, preco, ativo`,
    [req.params.id, nome, duracao_min, preco]
  );

  return res.status(201).json({ servico: resultado.rows[0] });
}

// Lista os serviços ativos de um negócio (público — cliente precisa ver pra agendar).
async function listar(req, res) {
  const resultado = await db.query(
    `SELECT id, nome, duracao_min, preco, ativo
     FROM servicos
     WHERE negocio_id = $1 AND ativo = true
     ORDER BY nome`,
    [req.params.id]
  );

  return res.json({ servicos: resultado.rows });
}

// Atualiza um serviço específico. O middleware de ownership já garantiu que
// req.negocio pertence ao usuário logado; aqui só confirmamos que o serviço
// realmente pertence a esse negócio (evita editar serviço de outro negócio).
async function atualizar(req, res) {
  const { nome, duracao_min, preco, ativo } = req.body;

  const resultado = await db.query(
    `UPDATE servicos
     SET nome = COALESCE($1, nome),
         duracao_min = COALESCE($2, duracao_min),
         preco = COALESCE($3, preco),
         ativo = COALESCE($4, ativo)
     WHERE id = $5 AND negocio_id = $6
     RETURNING id, nome, duracao_min, preco, ativo`,
    [nome || null, duracao_min || null, preco ?? null, ativo ?? null, req.params.servicoId, req.params.id]
  );

  if (resultado.rows.length === 0) {
    return res.status(404).json({ erro: 'Serviço não encontrado neste negócio.' });
  }

  return res.json({ servico: resultado.rows[0] });
}

// "Deleta" um serviço marcando como inativo (soft delete), pra não quebrar
// agendamentos antigos que referenciam esse serviço.
async function desativar(req, res) {
  const resultado = await db.query(
    `UPDATE servicos SET ativo = false
     WHERE id = $1 AND negocio_id = $2
     RETURNING id`,
    [req.params.servicoId, req.params.id]
  );

  if (resultado.rows.length === 0) {
    return res.status(404).json({ erro: 'Serviço não encontrado neste negócio.' });
  }

  return res.status(204).send();
}

module.exports = { criar, listar, atualizar, desativar };
