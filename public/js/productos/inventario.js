function convertirArchivoABase64(archivo) {
    return new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result);
        lector.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
        lector.readAsDataURL(archivo);
    });
}

function obtenerImagenProducto() {
    const inputImagen = document.getElementById('v-imagen');
    if (!inputImagen || !inputImagen.files || inputImagen.files.length === 0) {
        return Promise.resolve('img/default.jpg');
    }

    return convertirArchivoABase64(inputImagen.files[0]);
}

// Función para publicar un producto desde vendedor.html
async function publicarProducto(event) {
    event.preventDefault();

    const imagenProducto = await obtenerImagenProducto();
    const stockIngresado = parseInt(document.getElementById('v-stock').value, 10);
    const sesionActiva = JSON.parse(localStorage.getItem('sesion_activa'));

    if (Number.isNaN(stockIngresado) || stockIngresado < 0) {
        alert("La cantidad disponible debe ser 0 o mayor.");
        return;
    }

    const nuevoProducto = {
        nombre: document.getElementById('v-titulo').value,
        precio: parseFloat(document.getElementById('v-precio').value),
        stock: stockIngresado,
        imagen: imagenProducto,
        descripcion: document.getElementById('v-descripcion').value,
        vendedor: sesionActiva?.nombreCompleto || sesionActiva?.nombre || "Usuario",
        vendedorId: sesionActiva?.correo || "anonimo"
    };

    try {
        const response = await fetch('/api/productos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoProducto)
        });

        const data = await response.json();

        if (response.ok) {
            alert("¡Producto publicado con éxito! ✅");
            window.location.href = '/index.html';
        } else {
            alert("Error: " + data.error);
        }
    } catch (error) {
        alert("Error en la conexión: " + error.message);
    }
}

// Escuchamos el evento del formulario
const formPublicar = document.getElementById('form-publicar');
if (formPublicar) {
    formPublicar.addEventListener('submit', publicarProducto);
}

const inputImagen = document.getElementById('v-imagen');
const previewImagen = document.getElementById('v-preview-imagen');

if (inputImagen && previewImagen) {
    inputImagen.addEventListener('change', (event) => {
        const archivo = event.target.files && event.target.files[0];
        if (!archivo) {
            previewImagen.hidden = true;
            previewImagen.removeAttribute('src');
            return;
        }

        const urlTemporal = URL.createObjectURL(archivo);
        previewImagen.src = urlTemporal;
        previewImagen.hidden = false;
    });
}