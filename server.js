require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/auth.routes');
const perfilRoutes = require('./src/routes/perfil.routes');
const negocioRoutes = require('./src/routes/negocio.routes');
const agendamentoRoutes = require('./src/routes/agendamento.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/negocios', negocioRoutes);
app.use('/agendamentos', agendamentoRoutes);
app.use('/', perfilRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Middleware de erro central — captura exceções vindas das rotas async.
app.use((err, req, res, next) => {
  console.error(err);

  // Violação da EXCLUDE constraint do PostgreSQL = conflito de horário.
  if (err.code === '23P01') {
    return res.status(409).json({ erro: 'Este profissional já tem um agendamento nesse horário.' });
  }

  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
