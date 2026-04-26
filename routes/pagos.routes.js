const express = require('express');
const { db } = require('../services/firebase.service');
const {
    mpPreference,
    obtenerBaseUrl,
    esBaseUrlValidaParaCheckoutPro,
    obtenerYProcesarPago
} = require('../services/mercadopago.service');

const router = express.Router();

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

        const currencyId = String(process.env.MP_CURRENCY_ID || 'COP').trim().toUpperCase();
        const baseUrl = obtenerBaseUrl(req);

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
                success: `${baseUrl}/views/pagos/pago.html?resultado=success`,
                failure: `${baseUrl}/views/pagos/pago.html?resultado=failure`,
                pending: `${baseUrl}/views/pagos/pago.html?resultado=pending`
            },
            auto_return: 'approved',
            external_reference: `${correo}|${Date.now()}`,
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
            modoPrueba: String(process.env.MP_ACCESS_TOKEN || '').trim().startsWith('TEST-')
        });
    } catch (error) {
        const mensaje = String(error?.message || 'Error al crear preferencia en Mercado Pago');
        if (mensaje.toLowerCase().includes('currency_id invalid')) {
            return res.status(400).json({
                error: `Moneda invalida para tu cuenta de Mercado Pago. Revisa MP_CURRENCY_ID (actual: ${String(process.env.MP_CURRENCY_ID || 'COP').trim() || 'COP'}).`
            });
        }

        res.status(500).json({ error: mensaje });
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