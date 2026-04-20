const express = require('express');
const { db } = require('../services/firebase.service');

const router = express.Router();

router.get('/test', async (req, res) => {
    try {
        const doc = await db.collection('test').doc('conexion').get();
        res.json({ mensaje: 'Conectado a Firebase ✅', datos: doc.data() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;