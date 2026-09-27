const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Envolve handlers async para propagar erros ao middleware de erro do Express.
const assincrono = (fn) => (req, res, next) => fn(req, res, next).catch(next);

router.post('/registro', assincrono(authController.registrar));
router.post('/login', assincrono(authController.login));
router.post('/refresh', assincrono(authController.refresh));
router.post('/logout', assincrono(authController.logout));

module.exports = router;
