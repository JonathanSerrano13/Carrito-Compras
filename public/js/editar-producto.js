let productoIdEnEdicion = null;
let productoOriginal = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Obtener el ID del producto de los parámetros URL
    const params = new URLSearchParams(window.location.search);
    productoIdEnEdicion = params.get('id');

    if (!productoIdEnEdicion) {
        alert("Producto no encontrado");
        window.location.href = 'publicaciones.html';
        return;
    }

    try {
        // Cargar los datos del producto desde Firebase
        const response = await fetch('/api/productos');
        const productos = await response.json();
        const producto = productos.find(p => p.id === productoIdEnEdicion);

        if (!producto) {
            alert("Producto no encontrado");
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
            const precio = parseFloat(document.getElementById('e-precio').value);
            const stock = parseInt(document.getElementById('e-stock').value);
            const descripcion = document.getElementById('e-descripcion').value.trim();
            const inputImagen = document.getElementById('e-imagen');

            if (!titulo || precio <= 0 || stock < 0 || !descripcion) {
                alert("Por favor completa todos los campos correctamente");
                return;
            }

            // Si hay una nueva imagen, convertirla a base64
            let nuevaImagen = productoOriginal.imagen;
            if (inputImagen.files.length > 0) {
                nuevaImagen = await convertirArchivoABase64(inputImagen.files[0]);
            }

            // Actualizar producto en Firebase
            const productoActualizado = {
                nombre: titulo,
                precio: precio,
                stock: stock,
                descripcion: descripcion,
                imagen: nuevaImagen
            };

            try {
                const updateResponse = await fetch(`/api/productos/${productoIdEnEdicion}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(productoActualizado)
                });

                if (updateResponse.ok) {
                    alert("Producto actualizado correctamente ✅");
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
        alert("Error al cargar el producto");
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
