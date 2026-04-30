const express = require('express');
const { db } = require('../services/firebase.service');
const {
    mpPreference,
    obtenerBaseUrl,
    esBaseUrlValidaParaCheckoutPro,
    obtenerYProcesarPago
} = require('../services/mercadopago.service');

const router = express.Router();

function normalizarDireccionEnvio(direccionEnvio) {
    return {
        nombre: String(direccionEnvio?.nombre || '').trim(),
        telefono: String(direccionEnvio?.telefono || '').trim(),
        ciudad: String(direccionEnvio?.ciudad || '').trim(),
        direccion: String(direccionEnvio?.direccion || '').trim(),
        referencia: String(direccionEnvio?.referencia || '').trim()
    };
}

function direccionTieneContenido(direccionEnvio) {
    return Object.values(direccionEnvio || {}).some(valor => String(valor || '').trim());
}

function obtenerTiempoRegistro(data) {
    const candidatos = [data?.updatedAt, data?.createdAt, data?.fechaCreacion, data?.timestamp];

    for (const candidato of candidatos) {
        if (!candidato) continue;

        if (typeof candidato === 'number') {
            return candidato;
        }

        if (candidato?.toDate) {
            return candidato.toDate().getTime();
        }

        const fecha = new Date(candidato);
        if (!Number.isNaN(fecha.getTime())) {
            return fecha.getTime();
        }
    }

    return 0;
}

function crearClaveDireccion(direccionEnvio) {
    return [
        direccionEnvio.nombre,
        direccionEnvio.telefono,
        direccionEnvio.ciudad,
        direccionEnvio.direccion,
        direccionEnvio.referencia
    ]
        .map(valor => String(valor || '').trim().toLowerCase())
        .join('|');
}

function agregarDireccionUnica(registros, data, origen) {
    const direccionEnvio = normalizarDireccionEnvio(data?.direccionEnvio || {});

    if (!direccionTieneContenido(direccionEnvio)) {
        return registros;
    }

    const clave = crearClaveDireccion(direccionEnvio);
    const existente = registros.get(clave);
    const registro = {
        id: clave,
        ...direccionEnvio,
        origen,
        actualizadoEn: obtenerTiempoRegistro(data)
    };

    if (!existente || registro.actualizadoEn >= (existente.actualizadoEn || 0)) {
        registros.set(clave, registro);
    }

    return registros;
}

async function obtenerDireccionesGuardadasPorCorreo(correo) {
    if (!correo) {
        return [];
    }

    const registros = new Map();

    const [pagosSnap, comprasSnap] = await Promise.all([
        db.collection('pagos').where('correo', '==', correo).get(),
        db.collection('compras').where('clienteCorreo', '==', correo).get()
    ]);

    pagosSnap.forEach(doc => {
        agregarDireccionUnica(registros, doc.data() || {}, 'pago');
    });

    comprasSnap.forEach(doc => {
        agregarDireccionUnica(registros, doc.data() || {}, 'compra');
    });

    return Array.from(registros.values()).sort((a, b) => (b.actualizadoEn || 0) - (a.actualizadoEn || 0));
}

function esTokenDePrueba(accessToken) {
    return String(accessToken || '').trim().startsWith('TEST-');
}

function construirMensajeErrorMercadoPago(error) {
    const mensajeBase = String(error?.message || 'Error al crear preferencia en Mercado Pago');
    const cause = Array.isArray(error?.cause) ? error.cause : [];

    if (cause.length === 0) {
        return mensajeBase;
    }

    const detalles = cause
        .map(item => String(item?.description || item?.message || '').trim())
        .filter(Boolean)
        .join(' | ');

    return detalles ? `${mensajeBase}. Detalle: ${detalles}` : mensajeBase;
}

router.post('/pagos/crear-preferencia', async (req, res) => {
    try {
        if (!mpPreference) {
            return res.status(500).json({ error: 'Mercado Pago no configurado. Falta MP_ACCESS_TOKEN.' });
        }

        const { correo, cliente, direccionEnvio } = req.body;
        if (!correo) {
            return res.status(400).json({ error: 'Correo requerido para iniciar el pago' });
        }

        const direccionNormalizada = {
            nombre: String(direccionEnvio?.nombre || '').trim(),
            telefono: String(direccionEnvio?.telefono || '').trim(),
            ciudad: String(direccionEnvio?.ciudad || '').trim(),
            direccion: String(direccionEnvio?.direccion || '').trim(),
            referencia: String(direccionEnvio?.referencia || '').trim()
        };

        if (!direccionNormalizada.nombre || !direccionNormalizada.telefono || !direccionNormalizada.ciudad || !direccionNormalizada.direccion) {
            return res.status(400).json({ error: 'Faltan datos de direccion de envio.' });
        }

        const carritoSnap = await db.collection('carritos').doc(correo).get();
        const itemsCarrito = carritoSnap.exists ? (carritoSnap.data().items || []) : [];

        if (!Array.isArray(itemsCarrito) || itemsCarrito.length === 0) {
            return res.status(400).json({ error: 'El carrito esta vacio' });
        }

        const accessToken = String(process.env.MP_ACCESS_TOKEN || '').trim();
        const modoPrueba = esTokenDePrueba(accessToken);
        const currencyId = String(process.env.MP_CURRENCY_ID || 'MXN').trim().toUpperCase();
        const correoPagadorPrueba = String(process.env.MP_TEST_PAYER_EMAIL || '').trim();
        const correoPagador = modoPrueba && correoPagadorPrueba ? correoPagadorPrueba : correo;
        const baseUrl = obtenerBaseUrl(req);

        if (!correoPagador || !correoPagador.includes('@')) {
            return res.status(400).json({
                error: 'Correo de pagador invalido. En modo prueba puedes definir MP_TEST_PAYER_EMAIL con un usuario de prueba comprador.'
            });
        }

        if (!esBaseUrlValidaParaCheckoutPro(baseUrl)) {
            return res.status(400).json({
                error: 'PUBLIC_BASE_URL invalida para Checkout Pro. Usa una URL publica (no localhost), por ejemplo con ngrok.'
            });
        }

        const preferenceBody = {
            items: itemsCarrito.map(item => ({
                id: String(item.id),
                title: item.nombre,
                quantity: Number(item.cantidad) || 1,
                currency_id: currencyId,
                unit_price: Number(item.precio) || 0
            })),
            back_urls: {
                success: `${baseUrl}/views/pago.html?resultado=success`,
                failure: `${baseUrl}/views/pago.html?resultado=failure`,
                pending: `${baseUrl}/views/pago.html?resultado=pending`
            },
            auto_return: 'approved',
            external_reference: `${correo}|${Date.now()}`,
            payer: {
                email: correoPagador
            },
            metadata: {
                correo,
                cliente: cliente || 'Cliente',
                envioNombre: direccionNormalizada.nombre,
                envioTelefono: direccionNormalizada.telefono,
                envioCiudad: direccionNormalizada.ciudad,
                envioDireccion: direccionNormalizada.direccion,
                envioReferencia: direccionNormalizada.referencia
            }
        };

        // En pruebas, evitar que Mercado Pago recomiende solo saldo en cuenta (account_money)
        // para forzar que aparezcan opciones de tarjeta del comprador de prueba.
        if (modoPrueba) {
            preferenceBody.payment_methods = {
                excluded_payment_types: [{ id: 'account_money' }]
            };
        }

        if (process.env.MP_WEBHOOK_URL) {
            preferenceBody.notification_url = process.env.MP_WEBHOOK_URL;
        }

        const preferenceResponse = await mpPreference.create({ body: preferenceBody });

        await db.collection('pagos').doc(String(preferenceResponse.id)).set({
            preferenceId: String(preferenceResponse.id),
            correo,
            direccionEnvio: direccionNormalizada,
            status: 'preference_created',
            compraRegistrada: false,
            createdAt: new Date(),
            updatedAt: new Date()
        }, { merge: true });

        res.json({
            preferenceId: preferenceResponse.id,
            initPoint: preferenceResponse.init_point,
            sandboxInitPoint: preferenceResponse.sandbox_init_point,
            modoPrueba
        });
    } catch (error) {
        const mensaje = construirMensajeErrorMercadoPago(error);
        if (mensaje.toLowerCase().includes('currency_id invalid')) {
            return res.status(400).json({
                error: `Moneda invalida para tu cuenta de Mercado Pago. Revisa MP_CURRENCY_ID (actual: ${String(process.env.MP_CURRENCY_ID || 'MXN').trim() || 'MXN'}).`
            });
        }

        res.status(500).json({ error: mensaje });
    }
});

router.get('/pagos/direcciones/:correo', async (req, res) => {
    try {
        const correo = String(req.params.correo || '').trim();
        const direcciones = await obtenerDireccionesGuardadasPorCorreo(correo);

        res.json({ direcciones });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/pagos/estado/:paymentId', async (req, res) => {
    try {
        const paymentId = req.params.paymentId;
        const paymentData = await obtenerYProcesarPago(paymentId);

        res.json({
            id: paymentData.id,
            status: paymentData.status,
            statusDetail: paymentData.status_detail,
            transactionAmount: paymentData.transaction_amount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/pagos/webhook', async (req, res) => {
    try {
        const type = req.query.type || req.query.topic || req.body?.type || req.body?.topic;
        const paymentId = req.query['data.id'] || req.query.id || req.body?.data?.id || req.body?.id;

        if (type !== 'payment' || !paymentId) {
            return res.status(200).json({ ok: true });
        }

        await obtenerYProcesarPago(String(paymentId));
        return res.status(200).json({ ok: true });
    } catch (error) {
        return res.status(200).json({ ok: true, warning: error.message });
    }
});

module.exports = router;