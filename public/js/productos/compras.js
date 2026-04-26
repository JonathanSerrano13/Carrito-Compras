document.addEventListener('DOMContentLoaded', cargarCompras);

function construirTextoEnvio(direccionEnvio) {
    if (!direccionEnvio) return '';

    const nombre = String(direccionEnvio.nombre || '').trim();
    const telefono = String(direccionEnvio.telefono || '').trim();
    const ciudad = String(direccionEnvio.ciudad || '').trim();
    const direccion = String(direccionEnvio.direccion || '').trim();
    const referencia = String(direccionEnvio.referencia || '').trim();

    if (!nombre && !telefono && !ciudad && !direccion && !referencia) {
        return '';
    }

    const lineaPrincipal = [nombre, telefono].filter(Boolean).join(' - ');
    const lineaDireccion = [direccion, ciudad].filter(Boolean).join(', ');

    if (referencia) {
        return [lineaPrincipal, lineaDireccion, `Ref: ${referencia}`].filter(Boolean).join(' | ');
    }

    return [lineaPrincipal, lineaDireccion].filter(Boolean).join(' | ');
}

async function cargarCompras() {
    const listaCompras = document.getElementById('lista-compras');
    const sesionActiva = JSON.parse(localStorage.getItem('sesion_activa'));

    if (!sesionActiva?.correo) {
        listaCompras.innerHTML = '<p class="estado-vacio">Debes iniciar sesión</p>';
        return;
    }

    try {
        const response = await fetch(`/api/compras/${encodeURIComponent(sesionActiva.correo)}`);
        const historialCompras = await response.json();

        if (!Array.isArray(historialCompras) || historialCompras.length === 0) {
            listaCompras.innerHTML = '<p class="estado-vacio">No tienes compras registradas</p>';
            return;
        }

        listaCompras.innerHTML = historialCompras.map(compra => {
            const detalleEnvio = construirTextoEnvio(compra.direccionEnvio);

            return `
            <div class="tarjeta-orden">
                <div class="cabecera-orden">
                    <div>
                        <h3>Pedido #${compra.id}</h3>
                        <p class="fecha-orden">${compra.fecha}</p>
                    </div>
                    <div class="total-orden">
                        Total: <strong>$${Number(compra.total || 0).toLocaleString()}</strong>
                    </div>
                </div>
                ${detalleEnvio ? `
                <div class="envio-orden">
                    <span class="etiqueta-envio">Envío:</span>
                    <span class="detalle-envio">${detalleEnvio}</span>
                </div>
                ` : ''}
                <div class="productos-orden">
                    <h4>Productos:</h4>
                    <ul>
                        ${(compra.productos || []).map(prod => `
                            <li>
                                <img src="${prod.imagen}" alt="${prod.nombre}" class="imagen-orden">
                                <div class="info-orden">
                                    <span class="nombre-orden">${prod.nombre}</span>
                                    <span class="meta-orden">Cantidad: ${prod.cantidad} x $${Number(prod.precio || 0).toLocaleString()}</span>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;
        }).join('');
    } catch (error) {
        listaCompras.innerHTML = '<p class="estado-vacio">No se pudo cargar tu historial</p>';
    }
}
