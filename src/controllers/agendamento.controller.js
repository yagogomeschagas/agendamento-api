const db = require('../config/db');

// Cria um agendamento. A validação de conflito de horário é garantida pelo
// banco (EXCLUDE constraint + trigger na tabela agendamentos) — se colidir,
// o Postgres recusa a inserção e o middleware de erro do server.js devolve 409.
async function criar(req, res) {
  const { profissional_id, servico_id, data_hora } = req.body;

  if (!profissional_id || !servico_id || !data_hora) {
    return res.status(400).json({ erro: 'profissional_id, servico_id e data_hora são obrigatórios.' });
  }

  // Busca a duração do serviço e confirma que profissional e serviço são do mesmo negócio.
  const consulta = await db.query(
    `SELECT s.duracao_min, s.negocio_id AS servico_negocio_id, p.negocio_id AS profissional_negocio_id
     FROM servicos s, profissionais p
     WHERE s.id = $1 AND p.id = $2`,
    [servico_id, profissional_id]
  );

  if (consulta.rows.length === 0) {
    return res.status(404).json({ erro: 'Serviço ou profissional não encontrado.' });
  }

  const { duracao_min, servico_negocio_id, profissional_negocio_id } = consulta.rows[0];
  if (servico_negocio_id !== profissional_negocio_id) {
    return res.status(400).json({ erro: 'Este serviço não é oferecido por este profissional.' });
  }

  const resultado = await db.query(
    `INSERT INTO agendamentos (cliente_id, profissional_id, servico_id, data_hora, duracao_min)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, profissional_id, servico_id, data_hora, duracao_min, status`,
    [req.usuario.id, profissional_id, servico_id, data_hora, duracao_min]
  );

  return res.status(201).json({ agendamento: resultado.rows[0] });
}

// Verifica se o usuário logado pode mexer nesse agendamento:
// é o cliente que agendou, o profissional que atende, ou o dono do negócio.
async function podeGerenciar(agendamentoId, usuario) {
  const resultado = await db.query(
    `SELECT a.cliente_id, p.usuario_id AS profissional_usuario_id, n.dono_id
     FROM agendamentos a
     JOIN profissionais p ON p.id = a.profissional_id
     JOIN negocios n ON n.id = p.negocio_id
     WHERE a.id = $1`,
    [agendamentoId]
  );

  if (resultado.rows.length === 0) return { encontrado: false };

  const { cliente_id, profissional_usuario_id, dono_id } = resultado.rows[0];
  const podeGerenciar =
    usuario.id === cliente_id || usuario.id === profissional_usuario_id || usuario.id === dono_id;

  return { encontrado: true, podeGerenciar };
}

// Cancela ou remarca um agendamento.
async function atualizar(req, res) {
  const { status, data_hora } = req.body;

  const permissao = await podeGerenciar(req.params.id, req.usuario);
  if (!permissao.encontrado) {
    return res.status(404).json({ erro: 'Agendamento não encontrado.' });
  }
  if (!permissao.podeGerenciar) {
    return res.status(403).json({ erro: 'Você não tem permissão para alterar este agendamento.' });
  }

  const resultado = await db.query(
    `UPDATE agendamentos
     SET status = COALESCE($1, status),
         data_hora = COALESCE($2, data_hora)
     WHERE id = $3
     RETURNING id, profissional_id, servico_id, data_hora, duracao_min, status`,
    [status || null, data_hora || null, req.params.id]
  );

  return res.json({ agendamento: resultado.rows[0] });
}

// Agenda do profissional/dono logado (agendamentos futuros, mais próximos primeiro).
async function minhaAgenda(req, res) {
  const resultado = await db.query(
    `SELECT a.id, a.data_hora, a.duracao_min, a.status,
            u.nome AS cliente_nome, s.nome AS servico_nome
     FROM agendamentos a
     JOIN usuarios u ON u.id = a.cliente_id
     JOIN servicos s ON s.id = a.servico_id
     JOIN profissionais p ON p.id = a.profissional_id
     JOIN negocios n ON n.id = p.negocio_id
     WHERE (p.usuario_id = $1 OR n.dono_id = $1)
       AND a.data_hora >= now()
     ORDER BY a.data_hora ASC`,
    [req.usuario.id]
  );

  return res.json({ agendamentos: resultado.rows });
}

module.exports = { criar, atualizar, minhaAgenda };
