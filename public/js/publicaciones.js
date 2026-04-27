async function obtenerProductosPublicados() {
    try {
        const response = await fetch('/api/productos');
        const productos = await response.json();
        const sesionActiva = JSON.parse(localStorage.getItem('sesion_activa'));
        
        if (!sesionActiva?.correo) return [];
        return productos.filter(p => p.vendedorId === sesionActiva.correo);
    } catch (error) {
        console.error("Error al obtener productos:", error);
        return [];
    }
}

async function eliminarPublicacion(idProducto) {
    const confirmado = await window.appConfirm({
        titulo: 'Dar de baja publicación',
        mensaje: '¿Estás seguro de que deseas eliminar este producto?',
        textoConfirmar: 'Sí, eliminar',
        textoCancelar: 'Cancelar',
        tipo: 'warning'
    });

    if (!confirmado) return;

    try {
        const response = await fetch(`/api/productos/${idProducto}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert("Producto eliminado ✅");
            renderizarMisPublicaciones();
        } else {
            const data = await response.json();
            alert("Error: " + data.error);
        }
    } catch (error) {
        alert("Error en la conexión: " + error.message);
    }
}

function editarProducto(idProducto) {
    window.location.href = `/views/editar-producto.html?id=${idProducto}`;
}

async function renderizarMisPublicaciones() {
    const contenedor = document.getElementById('lista-mis-productos');
    const misProductos = await obtenerProductosPublicados();

    if (misProductos.length === 0) {
        contenedor.innerHTML = '<p class="estado-vacio">No has publicado productos aún</p>';
        return;
    }

    contenedor.innerHTML = misProductos.map(producto => `
        <div class="tarjeta-publicacion tarjeta-base">
            <img src="${producto.imagen}" alt="${producto.nombre}">
            <div class="info-publicacion">
                <h3 class="nombre-publicacion">${producto.nombre}</h3>
                <div class="precio-publicacion">$${producto.precio.toLocaleString()}</div>
                <div class="stock-publicacion">Stock: ${producto.stock}</div>
                <div class="acciones-publicacion">
                    <button class="boton-publicacion-editar boton-secundario" onclick="editarProducto('${producto.id}')">Editar</button>
                    <button class="boton-publicacion-eliminar boton-peligro" onclick="eliminarPublicacion('${producto.id}')">Dar de baja</button>
                </div>
            </div>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', renderizarMisPublicaciones);
