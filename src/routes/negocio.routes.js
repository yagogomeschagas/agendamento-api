const express = require('express');
const router = express.Router();

const negocioController = require('../controllers/negocio.controller');
const servicoController = require('../controllers/servico.controller');
const profissionalController = require('../controllers/profissional.controller');
const { autenticar, autorizar } = require('../middleware/auth');
const { verificarDonoDoNegocio } = require('../middleware/negocioOwnership');

const assincrono = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ---------- NEGÓCIOS ----------

// Só um admin pode criar um negócio (ele automaticamente vira o dono).
router.post('/', autenticar, autorizar('admin'), assincrono(negocioController.criar));

// Lista os negócios do admin logado.
router.get('/minhas', autenticar, autorizar('admin'), assincrono(negocioController.listarMeus));

// Ver detalhes de um negócio é público — cliente precisa disso pra agendar.
router.get('/:id', assincrono(negocioController.buscarPorId));

// Só o dono pode editar (verificarDonoDoNegocio confere isso).
router.patch('/:id', autenticar, verificarDonoDoNegocio, assincrono(negocioController.atualizar));

// ---------- SERVIÇOS ----------

router.post('/:id/servicos', autenticar, verificarDonoDoNegocio, assincrono(servicoController.criar));
router.get('/:id/servicos', assincrono(servicoController.listar));
router.patch('/:id/servicos/:servicoId', autenticar, verificarDonoDoNegocio, assincrono(servicoController.atualizar));
router.delete('/:id/servicos/:servicoId', autenticar, verificarDonoDoNegocio, assincrono(servicoController.desativar));

// ---------- PROFISSIONAIS ----------

router.post('/:id/profissionais', autenticar, verificarDonoDoNegocio, assincrono(profissionalController.vincular));
router.get('/:id/profissionais', assincrono(profissionalController.listar));
router.get('/:id/profissionais/:profissionalId/slots', assincrono(profissionalController.listarSlotsDisponiveis));
router.post(
  '/:id/profissionais/:profissionalId/disponibilidade',
  autenticar,
  verificarDonoDoNegocio,
  assincrono(profissionalController.definirDisponibilidade)
);

module.exports = router;
