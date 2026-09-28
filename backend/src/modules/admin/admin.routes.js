const express =require('express');
const router = express.Router();
const authController = require('./auth.controller');
const adminController = require('./admin.controller');

router.post('/register', adminController.register);
router.post('/login', adminController.login);
router.post('/logout', authController.logout);

module.exports = router;