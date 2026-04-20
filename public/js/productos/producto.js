// Variable global para validar el límite
let stockMaximo = 0;
let productoActual = null;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const idProducto = params.get('id');

    try {
        const response = await fetch('/api/productos');
        const productos = await response.json();
        const producto = productos.find(p => p.id === idProducto);

        if (producto) {
            productoActual = producto;
            stockMaximo = producto.stock;

            let nombreVendedor = producto.vendedor || 'Vendedor';
            const vendedorGenerico = !producto.vendedor || producto.vendedor === 'Vendedor' || producto.vendedor === 'Usuario';

            if (vendedorGenerico && producto.vendedorId && producto.vendedorId !== 'anonimo') {
                try {
                    const vendedorResponse = await fetch(`/api/usuarios/${encodeURIComponent(producto.vendedorId)}`);
                    if (vendedorResponse.ok) {
                        const vendedorData = await vendedorResponse.json();
                        nombreVendedor = vendedorData.nombreCompleto || vendedorData.nombre || 'Vendedor';
                    }
                } catch (error) {
                    console.error('No se pudo cargar el vendedor:', error);
                }
            }

            // Inyectar los datos en el HTML
            document.getElementById('p-img-principal').src = producto.imagen;
            document.getElementById('p-titulo-dinamico').innerText = producto.nombre;
            document.getElementById('p-precio-dinamico').innerText = `$${producto.precio.toLocaleString()}`;
            document.getElementById('p-nombre-vendedor').innerText = nombreVendedor;
            document.getElementById('p-descripcion-completa').innerText = producto.descripcion;

            // Mostrar texto de ayuda del stock
            const infoStock = document.getElementById('stock-disponible-texto');
            if (infoStock) {
                if (stockMaximo === 0) {
                    infoStock.innerText = '(Producto agotado)';
                } else {
                    infoStock.innerText = `(${stockMaximo} disponibles)`;
                }
            }

            // Deshabilitar botones si no hay stock
            const btnBuy = document.querySelector('.btn-buy');
            const btnCart = document.querySelector('.btn-cart');
            if (stockMaximo === 0) {
                if (btnBuy) {
                    btnBuy.disabled = true;
                    btnBuy.style.opacity = '0.5';
                    btnBuy.style.cursor = 'not-allowed';
                    btnBuy.innerText = 'Agotado';
                }
                if (btnCart) {
                    btnCart.disabled = true;
                    btnCart.style.opacity = '0.5';
                    btnCart.style.cursor = 'not-allowed';
                    btnCart.innerText = 'Agotado';
                }
            }
        }
    } catch (error) {
        console.error("Error al cargar el producto:", error);
        document.getElementById('p-titulo-dinamico').innerText = "Error al cargar el producto";
    }
});

// Nueva función para los botones + y -
function cambiarCantidad(valor) {
    const input = document.getElementById('p-cantidad-seleccionada');
    let actual = parseInt(input.value);
    let nueva = actual + valor;

    if (nueva >= 1 && nueva <= stockMaximo) {
        input.value = nueva;
    }
}

async function agregarProductoEnCarrito(producto, cantidad, correoUsuario) {
    const correo = encodeURIComponent(correoUsuario);

    try {
        const carritoResponse = await fetch(`/api/carrito/${correo}`);
        const carritoData = await carritoResponse.json();
        const carritoActual = carritoData.items || [];
        const itemExistente = carritoActual.find(item => item.id === producto.id);
        const cantidadActual = itemExistente ? itemExistente.cantidad : 0;

        if (cantidadActual + cantidad > stockMaximo) {
            alert("No puedes agregar más del stock disponible");
            return false;
        }

        const response = await fetch(`/api/carrito/${correo}/agregar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: producto.id,
                nombre: producto.nombre,
                precio: producto.precio,
                cantidad,
                imagen: producto.imagen
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'No se pudo actualizar el carrito');
        }

        if (typeof actualizarContadorCarrito === 'function') {
            actualizarContadorCarrito();
        }

        return true;
    } catch (error) {
        alert('Error al guardar carrito: ' + error.message);
        return false;
    }
}

async function agregarAlCarrito() {
    const sesionActiva = JSON.parse(localStorage.getItem('sesion_activa'));
    
    if (!sesionActiva) {
        alert("Debes iniciar sesión para agregar productos al carrito");
        window.location.href = '/views/auth/login.html';
        return;
    }

    const cantidad = parseInt(document.getElementById('p-cantidad-seleccionada').value);

    if (productoActual && await agregarProductoEnCarrito(productoActual, cantidad, sesionActiva.correo)) {
        alert("¡Producto añadido!");
    }
}

async function comprarDirecto() {
    return;
}