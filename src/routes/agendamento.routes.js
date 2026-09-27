const express = require('express');
const router = express.Router();

const agendamentoController = require('../controllers/agendamento.controller');
const { autenticar } = require('../middleware/auth');

const assincrono = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Qualquer usuário logado pode criar um agendamento pra si mesmo.
router.post('/', autenticar, assincrono(agendamentoController.criar));

// Cancelar ou remarcar: precisa ser o cliente, o profissional ou o dono do negócio.
router.patch('/:id', autenticar, assincrono(agendamentoController.atualizar));

// Agenda do profissional/dono logado.
router.get('/minha-agenda', autenticar, assincrono(agendamentoController.minhaAgenda));

module.exports = router;
