let productoIdEnEdicion = null;
let productoOriginal = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Obtener el ID del producto de los parámetros URL
    const params = new URLSearchParams(window.location.search);
    productoIdEnEdicion = params.get('id');

    if (!productoIdEnEdicion) {
        await window.appAlert('Producto no encontrado.', 'warning', 'Sin resultado');
        window.location.href = 'publicaciones.html';
        return;
    }

    try {
        // Cargar los datos del producto desde Firebase
        const response = await fetch('/api/productos');
        const productos = await response.json();
        const producto = productos.find(p => p.id === productoIdEnEdicion);

        if (!producto) {
            await window.appAlert('Producto no encontrado.', 'warning', 'Sin resultado');
            window.location.href = 'publicaciones.html';
            return;
        }

        productoOriginal = { ...producto };

        // Llenar el formulario con los datos actuales
        document.getElementById('e-titulo').value = producto.nombre;
        document.getElementById('e-precio').value = producto.precio;
        document.getElementById('e-stock').value = producto.stock;
        document.getElementById('e-descripcion').value = producto.descripcion;

        // Mostrar imagen actual como preview
        if (producto.imagen) {
            const previewImg = document.getElementById('e-preview-imagen');
            previewImg.src = producto.imagen;
            previewImg.hidden = false;
        }

        // Escuchar cambios en el input de archivo
        document.getElementById('e-imagen').addEventListener('change', (e) => {
            const archivo = e.target.files[0];
            if (archivo) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const previewImg = document.getElementById('e-preview-imagen');
                    previewImg.src = event.target.result;
                    previewImg.hidden = false;
                };
                reader.readAsDataURL(archivo);
            }
        });

        // Manejar envío del formulario
        const formEditar = document.getElementById('form-editar');
        formEditar.addEventListener('submit', async (e) => {
            e.preventDefault();

            const titulo = document.getElementById('e-titulo').value.trim();
            const precioTexto = document.getElementById('e-precio').value.trim();
            const stockTexto = document.getElementById('e-stock').value.trim();
            const descripcion = document.getElementById('e-descripcion').value.trim();
            const inputImagen = document.getElementById('e-imagen');

            const productoActualizado = {};

            if (titulo) {
                productoActualizado.nombre = titulo;
            }

            if (precioTexto !== '') {
                const precio = parseFloat(precioTexto);
                if (Number.isNaN(precio) || precio <= 0) {
                    alert("El precio debe ser mayor que 0.");
                    return;
                }
                productoActualizado.precio = precio;
            }

            if (stockTexto !== '') {
                const stock = parseInt(stockTexto, 10);
                if (Number.isNaN(stock) || stock < 0) {
                    alert("La cantidad disponible debe ser 0 o mayor.");
                    return;
                }
                productoActualizado.stock = stock;
            }

            if (descripcion) {
                productoActualizado.descripcion = descripcion;
            }

            // Si hay una nueva imagen, convertirla a base64
            if (inputImagen.files.length > 0) {
                productoActualizado.imagen = await convertirArchivoABase64(inputImagen.files[0]);
            }

            if (Object.keys(productoActualizado).length === 0) {
                alert("No hay cambios para guardar.");
                return;
            }

            try {
                const updateResponse = await fetch(`/api/productos/${productoIdEnEdicion}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(productoActualizado)
                });

                if (updateResponse.ok) {
                    await window.appAlert('Producto actualizado correctamente.', 'success', 'Cambios guardados');
                    window.location.href = 'publicaciones.html';
                } else {
                    const error = await updateResponse.json();
                    alert("Error: " + error.error);
                }
            } catch (error) {
                alert("Error en la conexión: " + error.message);
            }
        });
    } catch (error) {
        console.error("Error:", error);
        await window.appAlert('Error al cargar el producto.', 'error', 'Error');
        window.location.href = 'publicaciones.html';
    }
});

// Función auxiliar para convertir archivo a base64
function convertirArchivoABase64(archivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(archivo);
    });
}
