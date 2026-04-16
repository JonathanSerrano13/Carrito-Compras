const usuarioActivo = JSON.parse(localStorage.getItem('sesion_activa'));
const menu = document.getElementById('menu-usuario');

function obtenerInicialesUsuario(usuario) {
    if (!usuario) return 'U';

    const nombre = (usuario.nombre || '').trim();
    const apellido = (usuario.apellido || '').trim();

    if (nombre && apellido) {
        return `${nombre[0]}${apellido[0]}`.toUpperCase();
    }

    if (nombre.includes(' ')) {
        const partes = nombre.split(' ').filter(Boolean);
        if (partes.length >= 2) {
            return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
        }
    }

    return (nombre[0] || 'U').toUpperCase();
}

function obtenerNombreVisible(usuario) {
    if (!usuario) return 'Usuario';
    return (usuario.nombre || usuario.nombreCompleto || 'Usuario').trim();
}

// Actualizar el Header si hay sesión
if (menu) {
    if (usuarioActivo) {
        menu.innerHTML = `
            <div class="perfil-container">
                <div class="perfil-chip">
                    <span class="perfil-iniciales">${obtenerInicialesUsuario(usuarioActivo)}</span>
                    <span>Hola, <strong>${obtenerNombreVisible(usuarioActivo)}</strong></span>
                    <button class="perfil-menu-btn" onclick="toggleDropdown()" title="Menú">▼</button>
                </div>
                <div class="perfil-dropdown" id="perfil-dropdown">
                    <a href="/views/vendedor.html" class="dropdown-item">Vender</a>
                    <a href="/views/publicaciones.html" class="dropdown-item">Mis publicaciones</a>
                    <a href="/views/compras.html" class="dropdown-item">Mis compras</a>
                    <button class="dropdown-item btn-salir" onclick="cerrarSesion()">Salir</button>
                </div>
            </div>
            <a href="/views/carrito.html" class="cart-btn">Mi Carrito <span id="cart-count">0</span></a>
        `;
    } else {
        menu.innerHTML = `
            <a href="/views/login.html">Entrar</a>
            <a href="/views/carrito.html" class="cart-btn">Carrito <span id="count">0</span></a>
        `;
    }
}

function cerrarSesion() {
    localStorage.removeItem('sesion_activa');
    window.location.href = '/index.html';
}

function verificarProteccion() {
    if (!usuarioActivo && (window.location.pathname.includes('vendedor.html') || window.location.pathname.includes('carrito.html') || window.location.pathname.includes('publicaciones.html') || window.location.pathname.includes('compras.html'))) {
        alert("Acceso denegado. Inicia sesión.");
        window.location.href = '/views/login.html';
    }
}
verificarProteccion();

// Función global para actualizar el globito del carrito
async function actualizarContadorCarrito() {
    const contador = document.getElementById('cart-count') || document.getElementById('count');
    const sesion = JSON.parse(localStorage.getItem('sesion_activa'));

    if (!contador) return;
    if (!sesion?.correo) {
        contador.innerText = '0';
        contador.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`/api/carrito/${encodeURIComponent(sesion.correo)}`);
        const data = await response.json();
        const carrito = data.items || [];
        const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);

        contador.innerText = totalItems;
        contador.style.display = totalItems > 0 ? 'flex' : 'none';
    } catch (error) {
        contador.innerText = '0';
        contador.style.display = 'none';
    }
}

// La ejecutamos siempre que cargue cualquier página
document.addEventListener('DOMContentLoaded', actualizarContadorCarrito);

// Función para abrir/cerrar dropdown del perfil
function toggleDropdown() {
    const dropdown = document.getElementById('perfil-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Cerrar dropdown si haces click en otro lado
document.addEventListener('click', (e) => {
    const perfil = document.querySelector('.perfil-container');
    const dropdown = document.getElementById('perfil-dropdown');
    
    if (perfil && !perfil.contains(e.target) && dropdown) {
        dropdown.classList.remove('show');
    }
});