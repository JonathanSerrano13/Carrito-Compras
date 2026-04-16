const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

let db = null;
let firebaseInitError = null;

// Inicializar Firebase Admin (Vercel: variables de entorno, Local: firebase-key.json)
function obtenerCredencialesFirebase() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
        return {
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n')
        };
    }

    const keyPath = path.join(__dirname, 'firebase-key.json');
    if (fs.existsSync(keyPath)) {
        return require(keyPath);
    }

    throw new Error('Faltan credenciales de Firebase. Configura FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY o agrega firebase-key.json localmente.');
}

try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(obtenerCredencialesFirebase()),
            databaseURL: process.env.FIREBASE_DATABASE_URL || "https://carrito-compras-2f7d7.firebaseio.com"
        });
    }
    db = admin.firestore();
} catch (error) {
    firebaseInitError = error;
    console.error('Error inicializando Firebase:', error.message);
}

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Si Firebase falla en Vercel, no tumbar todo el sitio: responder claro en /api.
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

// Rutas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// RUTAS DE PRUEBA (para verificar conexión con Firebase)
app.get('/api/test', async (req, res) => {
    try {
        const doc = await db.collection('test').doc('conexion').get();
        res.json({ mensaje: "Conectado a Firebase ✅", datos: doc.data() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== AUTENTICACIÓN ==========
// Registro
app.post('/api/registro', async (req, res) => {
    try {
        const { nombre, apellido = '', correo, pass } = req.body;
        
        // Verificar si el usuario ya existe
        const userRef = db.collection('usuarios').doc(correo);
        const userSnap = await userRef.get();
        
        if (userSnap.exists) {
            return res.status(400).json({ error: "El usuario ya existe" });
        }
        
        // Crear usuario
        await userRef.set({
            nombre,
            apellido,
            correo,
            pass, // En producción: hashear con bcrypt
            fechaRegistro: new Date()
        });
        
        res.json({ mensaje: "Registro exitoso ✅", correo });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { correo, pass } = req.body;
        
        const userRef = db.collection('usuarios').doc(correo);
        const userSnap = await userRef.get();
        
        if (!userSnap.exists) {
            return res.status(401).json({ error: "Usuario no encontrado" });
        }
        
        const user = userSnap.data();
        if (user.pass !== pass) {
            return res.status(401).json({ error: "Contraseña incorrecta" });
        }
        
        res.json({ mensaje: "Login exitoso ✅", usuario: { nombre: user.nombre, apellido: user.apellido, nombreCompleto: `${user.nombre || ''} ${user.apellido || ''}`.trim(), correo: user.correo } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login/registro con Google
app.post('/api/google-auth', async (req, res) => {
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

// Obtener usuario por correo
app.get('/api/usuarios/:correo', async (req, res) => {
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

// ========== PRODUCTOS ==========
// Obtener todos los productos
app.get('/api/productos', async (req, res) => {
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

// Crear producto (publicar)
app.post('/api/productos', async (req, res) => {
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
        
        res.json({ mensaje: "Producto creado ✅", id: newProductRef.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar producto
app.put('/api/productos/:id', async (req, res) => {
    try {
        const { nombre, precio, stock, descripcion, imagen, vendedor } = req.body;
        
        await db.collection('productos').doc(req.params.id).update({
            nombre,
            precio,
            stock,
            descripcion,
            imagen,
            vendedor
        });
        
        res.json({ mensaje: "Producto actualizado ✅" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar producto
app.delete('/api/productos/:id', async (req, res) => {
    try {
        await db.collection('productos').doc(req.params.id).delete();
        res.json({ mensaje: "Producto eliminado ✅" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== CARRITO ==========
app.get('/api/carrito/:correo', async (req, res) => {
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

app.post('/api/carrito/:correo/agregar', async (req, res) => {
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

app.delete('/api/carrito/:correo/:productoId', async (req, res) => {
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

app.put('/api/carrito/:correo/:productoId', async (req, res) => {
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

app.delete('/api/carrito/:correo', async (req, res) => {
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

// ========== COMPRAS ==========
app.get('/api/compras/:correo', async (req, res) => {
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

app.post('/api/compras/:correo', async (req, res) => {
    try {
        const correo = req.params.correo;
        const { id, fecha, cliente, productos, total } = req.body;

        if (!Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({ error: 'No hay productos para registrar la compra' });
        }

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

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(3000, () => {
        console.log("Servidor corriendo en http://localhost:3000");
        console.log("Firebase conectado ✅");
    });
}

module.exports = app;