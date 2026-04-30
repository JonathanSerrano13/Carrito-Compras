document.addEventListener('DOMContentLoaded', () => {
    inicializarFormularioEnvio();
    cargarResumenPago();
    procesarRetornoPago();
});

function obtenerCamposEnvio() {
    return {
        nombre: document.getElementById('envio-nombre'),
        telefono: document.getElementById('envio-telefono'),
        ciudad: document.getElementById('envio-ciudad'),
        direccion: document.getElementById('envio-direccion'),
        referencia: document.getElementById('envio-referencia')
    };
}

function obtenerDireccionEnvio() {
    const campos = obtenerCamposEnvio();
    return {
        nombre: (campos.nombre?.value || '').trim(),
        telefono: (campos.telefono?.value || '').trim(),
        ciudad: (campos.ciudad?.value || '').trim(),
        direccion: (campos.direccion?.value || '').trim(),
        referencia: (campos.referencia?.value || '').trim()
    };
}

function validarDireccionEnvio(direccion) {
    if (!direccion.nombre) {
        return { esValida: false, mensaje: 'Ingresa el nombre de quien recibe.' };
    }

    if (!direccion.telefono) {
        return { esValida: false, mensaje: 'Ingresa un teléfono de contacto.' };
    }

    if (!direccion.ciudad) {
        return { esValida: false, mensaje: 'Ingresa la ciudad de entrega.' };
    }

    if (!direccion.direccion) {
        return { esValida: false, mensaje: 'Ingresa la dirección de envío.' };
    }

    return { esValida: true, mensaje: '' };
}

function actualizarEstadoBotonPago() {
    const boton = document.getElementById('btn-finalizar');
    if (!boton) return;

    const validacion = validarDireccionEnvio(obtenerDireccionEnvio());
    boton.disabled = !validacion.esValida;
}

function inicializarFormularioEnvio() {
    const campos = obtenerCamposEnvio();
    const sesionActiva = JSON.parse(localStorage.getItem('sesion_activa'));

    if (campos.nombre && sesionActiva?.nombreCompleto) {
        campos.nombre.value = sesionActiva.nombreCompleto;
    }

    [campos.nombre, campos.telefono, campos.ciudad, campos.direccion, campos.referencia].forEach((campo) => {
        if (!campo) return;
        campo.addEventListener('input', actualizarEstadoBotonPago);
    });

    actualizarEstadoBotonPago();
}

async function obtenerCarritoUsuario(correo) {
    const response = await fetch(`/api/carrito/${encodeURIComponent(correo)}`);
    const data = await response.json();
    return data.items || [];
}

async function cargarResumenPago() {
    const subtotalElement = document.getElementById('resumen-subtotal');
    const totalElement = document.getElementById('resumen-total');
    const sesionActiva = JSON.parse(localStorage.getItem('sesion_activa'));

    if (!sesionActiva?.correo) {
        subtotalElement.innerText = '$0';
        totalElement.innerText = '$0';
        return;
    }

    try {
        const carrito = await obtenerCarritoUsuario(sesionActiva.correo);
        const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
        subtotalElement.innerText = `$${total.toLocaleString()}`;
        totalElement.innerText = `$${total.toLocaleString()}`;
    } catch (error) {
        subtotalElement.innerText = '$0';
        totalElement.innerText = '$0';
    }
}

async function procesarPago() {
    const boton = document.getElementById('btn-finalizar');
    const sesionActiva = JSON.parse(localStorage.getItem('sesion_activa'));
    const direccionEnvio = obtenerDireccionEnvio();
    const validacionEnvio = validarDireccionEnvio(direccionEnvio);

    if (!sesionActiva?.correo) {
        alert('Debes iniciar sesión para pagar');
        window.location.href = '/views/login.html';
        return;
    }

    if (!validacionEnvio.esValida) {
        alert(validacionEnvio.mensaje);
        actualizarEstadoBotonPago();
        return;
    }

    try {
        const carrito = await obtenerCarritoUsuario(sesionActiva.correo);

        if (carrito.length === 0) {
            alert('El carrito está vacío');
            return;
        }

        if (boton) {
            boton.disabled = true;
            boton.textContent = 'Redirigiendo a Mercado Pago...';
        }

        const pagoResponse = await fetch('/api/pagos/crear-preferencia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                correo: sesionActiva.correo,
                cliente: sesionActiva?.nombreCompleto || sesionActiva?.nombre || 'Cliente',
                direccionEnvio
            })
        });

        if (!pagoResponse.ok) {
            const error = await pagoResponse.json();
            throw new Error(error.error || 'No se pudo iniciar el pago');
        }

        const pagoData = await pagoResponse.json();
        console.log('Respuesta crear-preferencia:', pagoData);
        const urlPago = pagoData.modoPrueba
            ? (pagoData.sandboxInitPoint || pagoData.initPoint)
            : (pagoData.initPoint || pagoData.sandboxInitPoint);

        if (!urlPago) {
            throw new Error('Mercado Pago no devolvió URL de checkout');
        }

        window.location.href = urlPago;
    } catch (error) {
        alert('Error al procesar pago: ' + error.message);
        if (boton) {
            boton.disabled = false;
            boton.textContent = 'Ir a pagar con Mercado Pago';
        }
        actualizarEstadoBotonPago();
    }
}

async function procesarRetornoPago() {
    const params = new URLSearchParams(window.location.search);
    const resultado = params.get('resultado');
    const paymentId = params.get('payment_id');

    if (!resultado) return;

    if (!paymentId) {
        if (resultado === 'failure') {
            alert('El pago no fue aprobado. Intenta de nuevo.');
        }
        if (resultado === 'pending') {
            alert('Tu pago quedó pendiente de confirmación.');
        }
        return;
    }

    try {
        const response = await fetch(`/api/pagos/estado/${encodeURIComponent(paymentId)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'No se pudo verificar el pago');
        }

        if (data.status === 'approved') {
            alert('Pago aprobado. Tu compra quedó registrada ✅');
            window.location.href = '/views/compras.html';
            return;
        }

        if (data.status === 'pending' || data.status === 'in_process') {
            alert('Tu pago está en revisión. Revisa en unos minutos.');
            return;
        }

        alert('El pago no fue aprobado. Puedes intentar nuevamente.');
    } catch (error) {
        alert('No se pudo verificar el estado del pago: ' + error.message);
    }
}
