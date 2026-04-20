const express = require('express');
const { db } = require('../services/firebase.service');

const router = express.Router();

router.post('/registro', async (req, res) => {
    try {
        const { nombre, apellido = '', correo, pass } = req.body;

        if (typeof pass !== 'string' || pass.length !== 6) {
            return res.status(400).json({ error: 'La contraseña debe tener exactamente 6 caracteres' });
        }

        const userRef = db.collection('usuarios').doc(correo);
        const userSnap = await userRef.get();

        if (userSnap.exists) {
            return res.status(400).json({ error: 'El usuario ya existe' });
        }

        await userRef.set({
            nombre,
            apellido,
            correo,
            pass,
            fechaRegistro: new Date()
        });

        res.json({ mensaje: 'Registro exitoso ✅', correo });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { correo, pass } = req.body;

        if (typeof pass !== 'string' || pass.length !== 6) {
            return res.status(400).json({ error: 'La contraseña debe tener exactamente 6 caracteres' });
        }

        const userRef = db.collection('usuarios').doc(correo);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        const user = userSnap.data();
        if (user.pass !== pass) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        res.json({
            mensaje: 'Login exitoso ✅',
            usuario: {
                nombre: user.nombre,
                apellido: user.apellido,
                nombreCompleto: `${user.nombre || ''} ${user.apellido || ''}`.trim(),
                correo: user.correo
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/google-auth', async (req, res) => {
    try {
        const { nombreCompleto, correo, fotoURL } = req.body;

        if (!correo) {
            return res.status(400).json({ error: 'Correo requerido' });
        }

        const userRef = db.collection('usuarios').doc(correo);
        const userSnap = await userRef.get();
        const partesNombre = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
        const nombre = partesNombre[0] || 'Usuario';
        const apellido = partesNombre.slice(1).join(' ') || '';

        const usuarioBase = {
            nombre,
            apellido,
            nombreCompleto: nombreCompleto || nombre,
            correo,
            fotoURL: fotoURL || '',
            proveedor: 'google',
            fechaUltimoIngreso: new Date()
        };

        if (userSnap.exists) {
            await userRef.set(usuarioBase, { merge: true });
        } else {
            await userRef.set({
                ...usuarioBase,
                fechaRegistro: new Date()
            });
        }

        res.json({
            mensaje: 'Google auth exitoso ✅',
            usuario: {
                nombre: usuarioBase.nombre,
                apellido: usuarioBase.apellido,
                nombreCompleto: usuarioBase.nombreCompleto,
                correo: usuarioBase.correo,
                fotoURL: usuarioBase.fotoURL,
                proveedor: usuarioBase.proveedor
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/usuarios/:correo', async (req, res) => {
    try {
        const correo = req.params.correo;
        const userSnap = await db.collection('usuarios').doc(correo).get();

        if (!userSnap.exists) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const user = userSnap.data();
        res.json({
            nombre: user.nombre || '',
            apellido: user.apellido || '',
            nombreCompleto: user.nombreCompleto || `${user.nombre || ''} ${user.apellido || ''}`.trim(),
            correo: user.correo || correo,
            fotoURL: user.fotoURL || ''
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;