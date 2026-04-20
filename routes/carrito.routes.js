const express = require('express');
const { db } = require('../services/firebase.service');

const router = express.Router();

router.get('/carrito/:correo', async (req, res) => {
    try {
        const correo = req.params.correo;
        const doc = await db.collection('carritos').doc(correo).get();

        if (!doc.exists) {
            return res.json({ items: [] });
        }

        const data = doc.data() || {};
        res.json({ items: Array.isArray(data.items) ? data.items : [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/carrito/:correo/agregar', async (req, res) => {
    try {
        const correo = req.params.correo;
        const { id, nombre, precio, cantidad, imagen } = req.body;

        if (!id || !nombre || Number(cantidad) <= 0) {
            return res.status(400).json({ error: 'Datos de producto inválidos' });
        }

        const carritoRef = db.collection('carritos').doc(correo);
        const carritoSnap = await carritoRef.get();
        const carritoActual = carritoSnap.exists ? (carritoSnap.data().items || []) : [];
        const index = carritoActual.findIndex(item => item.id === id);

        if (index >= 0) {
            carritoActual[index].cantidad += Number(cantidad);
        } else {
            carritoActual.push({
                id,
                nombre,
                precio: Number(precio) || 0,
                cantidad: Number(cantidad),
                imagen: imagen || 'img/default.jpg'
            });
        }

        await carritoRef.set({
            correo,
            items: carritoActual,
            updatedAt: new Date()
        }, { merge: true });

        res.json({ mensaje: 'Producto agregado al carrito ✅', items: carritoActual });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/carrito/:correo/:productoId', async (req, res) => {
    try {
        const { correo, productoId } = req.params;
        const carritoRef = db.collection('carritos').doc(correo);
        const carritoSnap = await carritoRef.get();

        if (!carritoSnap.exists) {
            return res.json({ mensaje: 'Carrito vacío', items: [] });
        }

        const items = (carritoSnap.data().items || []).filter(item => item.id !== productoId);

        await carritoRef.set({
            correo,
            items,
            updatedAt: new Date()
        }, { merge: true });

        res.json({ mensaje: 'Producto eliminado del carrito ✅', items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/carrito/:correo/:productoId', async (req, res) => {
    try {
        const { correo, productoId } = req.params;
        const nuevaCantidad = Number(req.body.cantidad);

        if (!Number.isInteger(nuevaCantidad) || nuevaCantidad < 1) {
            return res.status(400).json({ error: 'La cantidad debe ser un entero mayor o igual a 1' });
        }

        const carritoRef = db.collection('carritos').doc(correo);
        const carritoSnap = await carritoRef.get();

        if (!carritoSnap.exists) {
            return res.status(404).json({ error: 'Carrito no encontrado' });
        }

        const items = carritoSnap.data().items || [];
        const index = items.findIndex(item => item.id === productoId);

        if (index === -1) {
            return res.status(404).json({ error: 'Producto no encontrado en carrito' });
        }

        items[index].cantidad = nuevaCantidad;

        await carritoRef.set({
            correo,
            items,
            updatedAt: new Date()
        }, { merge: true });

        res.json({ mensaje: 'Cantidad actualizada ✅', items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/carrito/:correo', async (req, res) => {
    try {
        const correo = req.params.correo;
        await db.collection('carritos').doc(correo).set({
            correo,
            items: [],
            updatedAt: new Date()
        }, { merge: true });

        res.json({ mensaje: 'Carrito vaciado ✅' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;