const express = require('express');
const app = express();
const path = require('path');
require('dotenv').config();
const { db, firebaseInitError } = require('./services/firebase.service');

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use('/api', (req, res, next) => {
    if (!db) {
        return res.status(500).json({
            error: 'Firebase no configurado correctamente en el entorno.',
            detalle: firebaseInitError ? firebaseInitError.message : 'Sin detalles',
            faltantes: [
                'FIREBASE_PROJECT_ID',
                'FIREBASE_CLIENT_EMAIL',
                'FIREBASE_PRIVATE_KEY'
            ]
        });
    }
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/api', require('./routes/test.routes'));
app.use('/api', require('./routes/auth.routes'));
app.use('/api', require('./routes/productos.routes'));
app.use('/api', require('./routes/carrito.routes'));
app.use('/api', require('./routes/compras.routes'));
app.use('/api', require('./routes/pagos.routes'));

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(3000, () => {
        console.log("Servidor corriendo en http://localhost:3000");
        console.log("Firebase conectado ✅");
    });
}

module.exports = app;