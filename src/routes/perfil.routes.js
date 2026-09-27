const express = require('express');
const router = express.Router();
const { autenticar, autorizar } = require('../middleware/auth');

// Qualquer usuário autenticado pode ver o próprio perfil.
router.get('/perfil', autenticar, (req, res) => {
  res.json({ usuarioId: req.usuario.id, papel: req.usuario.papel });
});

// Exemplo de rota restrita a donos de negócio.
router.get('/admin/painel', autenticar, autorizar('admin'), (req, res) => {
  res.json({ mensagem: 'Bem-vindo ao painel administrativo.' });
});

module.exports = router;
