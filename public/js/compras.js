document.addEventListener('DOMContentLoaded', cargarCompras);

async function cargarCompras() {
    const listaCompras = document.getElementById('lista-compras');
    const sesionActiva = JSON.parse(localStorage.getItem('sesion_activa'));

    if (!sesionActiva?.correo) {
        listaCompras.innerHTML = '<p class="compras-empty">Debes iniciar sesión</p>';
        return;
    }

    try {
        const response = await fetch(`/api/compras/${encodeURIComponent(sesionActiva.correo)}`);
        const historialCompras = await response.json();

        if (!Array.isArray(historialCompras) || historialCompras.length === 0) {
            listaCompras.innerHTML = '<p class="compras-empty">No tienes compras registradas</p>';
            return;
        }

        listaCompras.innerHTML = historialCompras.map(compra => `
            <div class="compra-card">
                <div class="compra-header">
                    <div>
                        <h3>Pedido #${compra.id}</h3>
                        <p class="compra-fecha">${compra.fecha}</p>
                    </div>
                    <div class="compra-total">
                        Total: <strong>$${Number(compra.total || 0).toLocaleString()}</strong>
                    </div>
                </div>
                <div class="compra-productos">
                    <h4>Productos:</h4>
                    <ul>
                        ${(compra.productos || []).map(prod => `
                            <li>
                                <img src="${prod.imagen}" alt="${prod.nombre}" class="compra-prod-img">
                                <div class="compra-prod-info">
                                    <span class="compra-prod-nombre">${prod.nombre}</span>
                                    <span class="compra-prod-detalles">Cantidad: ${prod.cantidad} x $${Number(prod.precio || 0).toLocaleString()}</span>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `).join('');
    } catch (error) {
        listaCompras.innerHTML = '<p class="compras-empty">No se pudo cargar tu historial</p>';
    }
}
