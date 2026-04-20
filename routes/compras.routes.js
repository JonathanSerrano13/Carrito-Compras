const express = require('express');
const { db } = require('../services/firebase.service');
const { descontarStockProductos } = require('../services/mercadopago.service');

const router = express.Router();

router.get('/compras/:correo', async (req, res) => {
    try {
        const correo = req.params.correo;
        const snapshot = await db.collection('compras').where('clienteCorreo', '==', correo).get();
        const compras = [];

        snapshot.forEach(doc => {
            compras.push({ idDoc: doc.id, ...doc.data() });
        });

        compras.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        res.json(compras);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/compras/:correo', async (req, res) => {
    try {
        const correo = req.params.correo;
        const { id, fecha, cliente, productos, total } = req.body;

        if (!Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({ error: 'No hay productos para registrar la compra' });
        }

        await descontarStockProductos(productos);

        const compra = {
            id: id || Date.now(),
            fecha: fecha || new Date().toLocaleString('es-ES'),
            cliente: cliente || 'Cliente',
            clienteCorreo: correo,
            productos,
            total: Number(total) || 0,
            timestamp: Date.now(),
            fechaCreacion: new Date()
        };

        await db.collection('compras').add(compra);
        res.json({ mensaje: 'Compra registrada ✅' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;