document.addEventListener('DOMContentLoaded', async () => {
    const contenedor = document.getElementById('catalogo-principal');
    
    try {
        // Obtener productos desde Firebase
        const response = await fetch('/api/productos');
        const productos = await response.json();

        if (productos.length === 0) {
            contenedor.innerHTML = "<p>No hay productos disponibles por ahora.</p>";
            return;
        }

        // Limpiamos el contenedor e inyectamos el HTML dinámico
        contenedor.innerHTML = productos.map(p => `
            <div class="product-card ${p.stock === 0 ? 'product-agotado' : ''}" onclick="${p.stock === 0 ? '' : `verDetalle('${p.id}')`}">
                <div class="product-image">
                    <img src="${p.imagen}" alt="${p.nombre}">
                    ${p.stock === 0 ? '<div class="stock-badge">Agotado</div>' : ''}
                </div>
                <div class="product-info">
                    <h3 class="product-name">${p.nombre}</h3>
                    <span class="price-value">$${p.precio.toLocaleString()}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        contenedor.innerHTML = `<p>Error al cargar productos: ${error.message}</p>`;
    }
});

// Función para ir a la vista de detalle
function verDetalle(id) {
    window.location.href = `/views/productos/producto.html?id=${id}`;
}