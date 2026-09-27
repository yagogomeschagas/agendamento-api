const db = require('../config/db');

// Vincula um usuário já existente como profissional do negócio.
// O dono informa o email de alguém que já se cadastrou como 'cliente';
// aqui promovemos esse usuário a profissional daquele negócio específico.
async function vincular(req, res) {
  const { email, especialidades } = req.body;

  if (!email) {
    return res.status(400).json({ erro: 'email do usuário é obrigatório.' });
  }

  const usuarioResultado = await db.query('SELECT id FROM usuarios WHERE email = $1', [email]);
  const usuario = usuarioResultado.rows[0];

  if (!usuario) {
    return res.status(404).json({ erro: 'Nenhum usuário encontrado com esse email. Peça para a pessoa se registrar primeiro.' });
  }

  const jaVinculado = await db.query(
    'SELECT id FROM profissionais WHERE usuario_id = $1 AND negocio_id = $2',
    [usuario.id, req.params.id]
  );
  if (jaVinculado.rows.length > 0) {
    return res.status(409).json({ erro: 'Este usuário já é profissional deste negócio.' });
  }

  const resultado = await db.query(
    `INSERT INTO profissionais (usuario_id, negocio_id, especialidades)
     VALUES ($1, $2, $3)
     RETURNING id, usuario_id, especialidades, ativo`,
    [usuario.id, req.params.id, especialidades || null]
  );

  // Promove o papel do usuário para 'profissional', se ainda não for.
  await db.query(
    `UPDATE usuarios SET papel = 'profissional' WHERE id = $1 AND papel = 'cliente'`,
    [usuario.id]
  );

  return res.status(201).json({ profissional: resultado.rows[0] });
}

// Lista os profissionais ativos de um negócio (público).
async function listar(req, res) {
  const resultado = await db.query(
    `SELECT p.id, p.especialidades, p.ativo, u.nome, u.email
     FROM profissionais p
     JOIN usuarios u ON u.id = p.usuario_id
     WHERE p.negocio_id = $1 AND p.ativo = true
     ORDER BY u.nome`,
    [req.params.id]
  );

  return res.json({ profissionais: resultado.rows });
}

// Define a disponibilidade semanal recorrente de um profissional.
// dia_semana: 0 (domingo) a 6 (sábado).
async function definirDisponibilidade(req, res) {
  const { dia_semana, hora_inicio, hora_fim } = req.body;

  if (dia_semana === undefined || !hora_inicio || !hora_fim) {
    return res.status(400).json({ erro: 'dia_semana, hora_inicio e hora_fim são obrigatórios.' });
  }

  // Confirma que o profissional pertence ao negócio da URL.
  const profissional = await db.query(
    'SELECT id FROM profissionais WHERE id = $1 AND negocio_id = $2',
    [req.params.profissionalId, req.params.id]
  );
  if (profissional.rows.length === 0) {
    return res.status(404).json({ erro: 'Profissional não encontrado neste negócio.' });
  }

  const resultado = await db.query(
    `INSERT INTO disponibilidades (profissional_id, dia_semana, hora_inicio, hora_fim)
     VALUES ($1, $2, $3, $4)
     RETURNING id, dia_semana, hora_inicio, hora_fim`,
    [req.params.profissionalId, dia_semana, hora_inicio, hora_fim]
  );

  return res.status(201).json({ disponibilidade: resultado.rows[0] });
}

// Calcula os horários livres de um profissional num dia específico,
// considerando a disponibilidade semanal dele e os agendamentos já feitos.
async function listarSlotsDisponiveis(req, res) {
  const { data, servico_id } = req.query;

  if (!data || !servico_id) {
    return res.status(400).json({ erro: 'Os parâmetros "data" (YYYY-MM-DD) e "servico_id" são obrigatórios.' });
  }

  // Confirma que o profissional pertence ao negócio da URL.
  const profissional = await db.query(
    'SELECT id FROM profissionais WHERE id = $1 AND negocio_id = $2 AND ativo = true',
    [req.params.profissionalId, req.params.id]
  );
  if (profissional.rows.length === 0) {
    return res.status(404).json({ erro: 'Profissional não encontrado neste negócio.' });
  }

  // Confirma que o serviço pertence ao mesmo negócio e pega a duração dele.
  const servico = await db.query(
    'SELECT duracao_min FROM servicos WHERE id = $1 AND negocio_id = $2 AND ativo = true',
    [servico_id, req.params.id]
  );
  if (servico.rows.length === 0) {
    return res.status(404).json({ erro: 'Serviço não encontrado neste negócio.' });
  }
  const duracaoMin = servico.rows[0].duracao_min;

  // Descobre o dia da semana (0=domingo) a partir da data recebida.
  const diaSemana = new Date(`${data}T00:00:00`).getDay();

  const disponibilidades = await db.query(
    `SELECT hora_inicio, hora_fim FROM disponibilidades
     WHERE profissional_id = $1 AND dia_semana = $2
     ORDER BY hora_inicio`,
    [req.params.profissionalId, diaSemana]
  );

  if (disponibilidades.rows.length === 0) {
    return res.json({ slots: [] }); // profissional não trabalha nesse dia da semana
  }

  // Agendamentos já existentes desse profissional nesse dia (ativos).
  const agendamentosExistentes = await db.query(
    `SELECT data_hora, duracao_min FROM agendamentos
     WHERE profissional_id = $1
       AND status IN ('pendente', 'confirmado')
       AND data_hora::date = $2::date`,
    [req.params.profissionalId, data]
  );
  const ocupados = agendamentosExistentes.rows.map((a) => ({
    inicio: new Date(a.data_hora),
    fim: new Date(new Date(a.data_hora).getTime() + a.duracao_min * 60000),
  }));

  const slotsLivres = [];

  // Para cada janela de disponibilidade do dia, gera candidatos de
  // `duracaoMin` em `duracaoMin` minutos e descarta os que colidem.
  for (const janela of disponibilidades.rows) {
    let cursor = new Date(`${data}T${janela.hora_inicio}`);
    const fimJanela = new Date(`${data}T${janela.hora_fim}`);

    while (cursor.getTime() + duracaoMin * 60000 <= fimJanela.getTime()) {
      const candidatoFim = new Date(cursor.getTime() + duracaoMin * 60000);

      const colide = ocupados.some(
        (o) => cursor < o.fim && candidatoFim > o.inicio
      );

      if (!colide) {
        slotsLivres.push(cursor.toISOString());
      }

      cursor = new Date(cursor.getTime() + duracaoMin * 60000);
    }
  }

  return res.json({ slots: slotsLivres });
}

module.exports = { vincular, listar, definirDisponibilidade, listarSlotsDisponiveis };
