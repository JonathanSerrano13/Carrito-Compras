const express = require('express');
const { db } = require('../services/firebase.service');

const router = express.Router();

router.get('/productos', async (req, res) => {
    try {
        const snapshot = await db.collection('productos').get();
        const productos = [];

        snapshot.forEach(doc => {
            productos.push({ id: doc.id, ...doc.data() });
        });

        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/productos', async (req, res) => {
    try {
        const { nombre, precio, stock, descripcion, imagen, vendedorId, vendedor } = req.body;

        const newProductRef = db.collection('productos').doc();
        await newProductRef.set({
            nombre,
            precio,
            stock,
            descripcion,
            imagen,
            vendedor: vendedor || 'Vendedor',
            vendedorId,
            fechaCreacion: new Date()
        });

        res.json({ mensaje: 'Producto creado ✅', id: newProductRef.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/productos/:id', async (req, res) => {
    try {
        const { nombre, precio, stock, descripcion, imagen, vendedor } = req.body;
        const productoRef = db.collection('productos').doc(req.params.id);
        const productoSnap = await productoRef.get();

        if (!productoSnap.exists) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const actualizacion = {};

        if (nombre !== undefined) actualizacion.nombre = nombre;
        if (precio !== undefined) actualizacion.precio = precio;
        if (stock !== undefined) actualizacion.stock = stock;
        if (descripcion !== undefined) actualizacion.descripcion = descripcion;
        if (imagen !== undefined) actualizacion.imagen = imagen;
        if (vendedor !== undefined) actualizacion.vendedor = vendedor;

        if (Object.keys(actualizacion).length === 0) {
            return res.status(400).json({ error: 'No se enviaron campos válidos para actualizar' });
        }

        await productoRef.update(actualizacion);

        res.json({ mensaje: 'Producto actualizado ✅' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/productos/:id', async (req, res) => {
    try {
        await db.collection('productos').doc(req.params.id).delete();
        res.json({ mensaje: 'Producto eliminado ✅' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;