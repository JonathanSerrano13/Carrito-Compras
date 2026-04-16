document.addEventListener('DOMContentLoaded', cargarResumenPago);

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
    const sesionActiva = JSON.parse(localStorage.getItem('sesion_activa'));
    if (!sesionActiva?.correo) {
        alert('Debes iniciar sesión para pagar');
        window.location.href = '/views/login.html';
        return;
    }

    try {
        const carrito = await obtenerCarritoUsuario(sesionActiva.correo);

        if (carrito.length === 0) {
            alert('El carrito está vacío');
            return;
        }

        const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
        const compra = {
            id: Date.now(),
            fecha: new Date().toLocaleString('es-ES'),
            cliente: sesionActiva?.nombreCompleto || sesionActiva?.nombre || 'Cliente',
            productos: carrito,
            total
        };

        const compraResponse = await fetch(`/api/compras/${encodeURIComponent(sesionActiva.correo)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(compra)
        });

        if (!compraResponse.ok) {
            const error = await compraResponse.json();
            throw new Error(error.error || 'No se pudo registrar la compra');
        }

        await fetch(`/api/carrito/${encodeURIComponent(sesionActiva.correo)}`, { method: 'DELETE' });

        if (typeof actualizarContadorCarrito === 'function') {
            actualizarContadorCarrito();
        }

        alert('Procesando pago... ¡Gracias por tu compra!');
        window.location.href = '/index.html';
    } catch (error) {
        alert('Error al procesar pago: ' + error.message);
    }
}