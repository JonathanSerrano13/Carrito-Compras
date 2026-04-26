const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { db } = require('./firebase.service');

const mercadopagoAccessToken = String(process.env.MP_ACCESS_TOKEN || '').trim();
const mercadopagoClient = mercadopagoAccessToken ? new MercadoPagoConfig({ accessToken: mercadopagoAccessToken }) : null;
const mpPreference = mercadopagoClient ? new Preference(mercadopagoClient) : null;
const mpPayment = mercadopagoClient ? new Payment(mercadopagoClient) : null;

function obtenerBaseUrl(req) {
    if (process.env.PUBLIC_BASE_URL) {
        return String(process.env.PUBLIC_BASE_URL).trim().replace(/\/$/, '');
    }

    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    return `${proto}://${req.get('host')}`;
}

function esBaseUrlValidaParaCheckoutPro(baseUrl) {
    try {
        const url = new URL(baseUrl);
        const host = (url.hostname || '').toLowerCase();
        const esLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
        return (url.protocol === 'https:' || url.protocol === 'http:') && !esLocal;
    } catch (error) {
        return false;
    }
}

function extraerCorreoDePago(paymentData) {
    const correoMetadata = String(paymentData?.metadata?.correo || '').trim();
    if (correoMetadata) {
        return correoMetadata;
    }

    const referencia = String(paymentData?.external_reference || '').trim();
    if (!referencia) {
        return '';
    }

    const [correoReferenciado] = referencia.split('|');
    return String(correoReferenciado || '').trim();
}

async function obtenerDireccionEnvioDesdePagos(correo) {
    if (!correo) {
        return null;
    }

    const snapshot = await db.collection('pagos')
        .where('correo', '==', correo)
        .get();

    const registros = [];
    snapshot.forEach(doc => {
        const data = doc.data() || {};
        const direccionEnvio = data.direccionEnvio || null;
        const tieneDireccion = direccionEnvio && Object.values(direccionEnvio).some(valor => String(valor || '').trim());

        if (tieneDireccion) {
            registros.push({
                direccionEnvio,
                createdAt: data.createdAt ? new Date(data.createdAt).getTime() : 0
            });
        }
    });

    if (registros.length === 0) {
        return null;
    }

    registros.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return registros[0].direccionEnvio;
}

async function descontarStockProductos(productos) {
    if (!Array.isArray(productos) || productos.length === 0) {
        return;
    }

    await db.runTransaction(async (transaction) => {
        for (const item of productos) {
            const cantidad = Number(item.cantidad) || 0;
            const productoId = String(item.id || '');

            if (!productoId || cantidad <= 0) {
                throw new Error('Producto o cantidad invalida al descontar stock');
            }

            const productoRef = db.collection('productos').doc(productoId);
            const productoSnap = await transaction.get(productoRef);

            if (!productoSnap.exists) {
                throw new Error(`El producto ${item.nombre || productoId} ya no existe`);
            }

            const stockActual = Number(productoSnap.data()?.stock) || 0;
            if (stockActual < cantidad) {
                throw new Error(`Stock insuficiente para ${item.nombre || productoId}`);
            }

            transaction.update(productoRef, {
                stock: stockActual - cantidad
            });
        }
    });
}

async function registrarCompraDesdePago(paymentData) {
    const paymentId = String(paymentData.id || '');
    if (!paymentId) return;

    const pagoRef = db.collection('pagos').doc(paymentId);
    const pagoSnap = await pagoRef.get();

    if (pagoSnap.exists && pagoSnap.data()?.compraRegistrada) {
        return;
    }

    if (paymentData.status !== 'approved') {
        await pagoRef.set({
            paymentId,
            status: paymentData.status || 'unknown',
            statusDetail: paymentData.status_detail || '',
            compraRegistrada: false,
            updatedAt: new Date()
        }, { merge: true });
        return;
    }

    const correo = extraerCorreoDePago(paymentData);
    const direccionEnvioMetadata = {
        nombre: String(paymentData.metadata?.envioNombre || '').trim(),
        telefono: String(paymentData.metadata?.envioTelefono || '').trim(),
        ciudad: String(paymentData.metadata?.envioCiudad || '').trim(),
        direccion: String(paymentData.metadata?.envioDireccion || '').trim(),
        referencia: String(paymentData.metadata?.envioReferencia || '').trim()
    };
    const direccionEnvio = Object.values(direccionEnvioMetadata).some(valor => String(valor || '').trim())
        ? direccionEnvioMetadata
        : (await obtenerDireccionEnvioDesdePagos(correo)) || direccionEnvioMetadata;
    if (!correo) {
        await pagoRef.set({
            paymentId,
            status: paymentData.status || 'approved',
            statusDetail: paymentData.status_detail || '',
            compraRegistrada: false,
            error: 'No se encontro correo en metadata',
            updatedAt: new Date()
        }, { merge: true });
        return;
    }

    const carritoRef = db.collection('carritos').doc(correo);
    const carritoSnap = await carritoRef.get();
    const productos = carritoSnap.exists ? (carritoSnap.data().items || []) : [];

    const totalCalculado = productos.reduce((sum, item) => sum + ((Number(item.precio) || 0) * (Number(item.cantidad) || 0)), 0);
    const totalFinal = Number(paymentData.transaction_amount) || totalCalculado;

    if (!Array.isArray(productos) || productos.length === 0) {
        await pagoRef.set({
            paymentId,
            correo,
            status: paymentData.status || 'approved',
            statusDetail: paymentData.status_detail || '',
            compraRegistrada: false,
            aviso: 'Pago aprobado sin items en carrito',
            updatedAt: new Date()
        }, { merge: true });
        return;
    }

    let ajusteStockError = '';
    try {
        await descontarStockProductos(productos);
    } catch (error) {
        ajusteStockError = String(error?.message || 'No se pudo descontar stock');
    }

    await db.collection('compras').add({
        id: Date.now(),
        fecha: new Date().toLocaleString('es-ES'),
        cliente: paymentData.metadata?.cliente || 'Cliente',
        clienteCorreo: correo,
        direccionEnvio,
        productos,
        total: totalFinal,
        timestamp: Date.now(),
        fechaCreacion: new Date(),
        origenPago: 'mercadopago',
        paymentId,
        ajusteStockError
    });

    await carritoRef.set({
        correo,
        items: [],
        updatedAt: new Date()
    }, { merge: true });

    await pagoRef.set({
        paymentId,
        correo,
        direccionEnvio,
        status: paymentData.status || 'approved',
        statusDetail: paymentData.status_detail || '',
        compraRegistrada: true,
        total: totalFinal,
        preferenceId: paymentData.order?.id || paymentData.metadata?.preferenceId || '',
        ajusteStockError,
        updatedAt: new Date()
    }, { merge: true });
}

async function obtenerYProcesarPago(paymentId) {
    if (!mpPayment) {
        throw new Error('Mercado Pago no configurado. Define MP_ACCESS_TOKEN.');
    }

    const paymentData = await mpPayment.get({ id: paymentId });
    await registrarCompraDesdePago(paymentData);
    return paymentData;
}

module.exports = {
    mpPreference,
    mpPayment,
    obtenerBaseUrl,
    esBaseUrlValidaParaCheckoutPro,
    descontarStockProductos,
    registrarCompraDesdePago,
    obtenerYProcesarPago
};