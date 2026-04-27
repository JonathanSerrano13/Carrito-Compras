document.addEventListener('DOMContentLoaded', cargarCarrito);

let carritoActual = [];

async function obtenerCarritoUsuario(correo) {
    const response = await fetch(`/api/carrito/${encodeURIComponent(correo)}`);
    const data = await response.json();
    return data.items || [];
}

function actualizarContadorLocal(items) {
    const contador = document.getElementById('cart-count') || document.getElementById('count');
    if (!contador) return;

    const totalItems = items.reduce((acc, item) => acc + item.cantidad, 0);
    contador.innerText = totalItems;
    contador.style.display = totalItems > 0 ? 'flex' : 'none';
}

function renderizarCarrito(items) {
    const listaCarrito = document.getElementById('lista-carrito');
    const totalElement = document.getElementById('total-compra');

    carritoActual = items;

    if (!items || items.length === 0) {
        listaCarrito.innerHTML = '<tr><td colspan="3" class="estado-vacio">Tu carrito está vacío</td></tr>';
        totalElement.innerText = '0';
        actualizarContadorLocal([]);
        return;
    }

    let total = 0;
    listaCarrito.innerHTML = '';

    items.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;

        const row = document.createElement('tr');
        row.className = 'cart-row';
        row.innerHTML = `
            <td>
                <div class="cart-product-cell">
                    <img src="${item.imagen}" width="60" alt="${item.nombre}">
                    <div>
                        <strong>${item.nombre}</strong>
                        <div class="cart-qty-control">
                            <button type="button" onclick="cambiarCantidadEnCarrito('${item.id}', -1)">-</button>
                            <span class="cart-qty-value">${item.cantidad}</span>
                            <button type="button" onclick="cambiarCantidadEnCarrito('${item.id}', 1)">+</button>
                        </div>
                    </div>
                </div>
            </td>
            <td class="cart-subtotal">$${subtotal.toLocaleString()}</td>
            <td>
                <button class="cart-remove-btn" onclick="eliminarDelCarrito('${item.id}')">Eliminar</button>
            </td>
        `;
        listaCarrito.appendChild(row);
    });

    totalElement.innerText = total.toLocaleString();
    actualizarContadorLocal(items);
}

async function cargarCarrito() {
    const listaCarrito = document.getElementById('lista-carrito');
    const totalElement = document.getElementById('total-compra');
    const sesionActiva = JSON.parse(localStorage.getItem('sesion_activa'));

    if (!sesionActiva?.correo) {
        listaCarrito.innerHTML = '<tr><td colspan="3" class="estado-vacio">Debes iniciar sesión</td></tr>';
        totalElement.innerText = '0';
        return;
    }

    try {
        const items = await obtenerCarritoUsuario(sesionActiva.correo);
        renderizarCarrito(items);
    } catch (error) {
        listaCarrito.innerHTML = '<tr><td colspan="3" class="estado-vacio">Error al cargar carrito</td></tr>';
        totalElement.innerText = '0';
    }
}

async function cambiarCantidadEnCarrito(productoId, delta) {
    const sesionActiva = JSON.parse(localStorage.getItem('sesion_activa'));
    if (!sesionActiva?.correo) return;

    try {
        const item = carritoActual.find(prod => prod.id === productoId);
        if (!item) return;

        const nuevaCantidad = item.cantidad + delta;
        if (nuevaCantidad < 1) return;

        const response = await fetch(`/api/carrito/${encodeURIComponent(sesionActiva.correo)}/${encodeURIComponent(productoId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cantidad: nuevaCantidad })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'No se pudo cambiar la cantidad');
        }

        const data = await response.json();
        renderizarCarrito(data.items || []);
    } catch (error) {
        alert('No se pudo actualizar la cantidad');
    }
}

async function eliminarDelCarrito(productoId) {
    const sesionActiva = JSON.parse(localStorage.getItem('sesion_activa'));
    if (!sesionActiva?.correo) return;

    try {
        const response = await fetch(`/api/carrito/${encodeURIComponent(sesionActiva.correo)}/${encodeURIComponent(productoId)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('No se pudo eliminar del carrito');
        }

        const data = await response.json();
        renderizarCarrito(data.items || []);
    } catch (error) {
        alert('No se pudo eliminar del carrito');
    }
}

async function irAPago() {
    const sesionActiva = JSON.parse(localStorage.getItem('sesion_activa'));
    if (!sesionActiva?.correo) {
        await window.appAlert('Debes iniciar sesión para continuar con el pago', 'warning', 'Inicia sesión');
        window.location.href = '/views/auth/login.html';
        return;
    }

    if (!carritoActual.length) {
        alert('Tu carrito está vacío');
        return;
    }

    window.location.href = '/views/pagos/pago.html';
}