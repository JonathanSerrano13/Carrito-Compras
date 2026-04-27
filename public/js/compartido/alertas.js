(function () {
    const alertaNativa = window.alert ? window.alert.bind(window) : null;
    const confirmNativo = window.confirm ? window.confirm.bind(window) : null;

    function tieneSweetAlert() {
        return typeof window.Swal !== 'undefined';
    }

    function obtenerIcono(tipo) {
        if (['success', 'error', 'warning', 'info', 'question'].includes(tipo)) {
            return tipo;
        }
        return 'info';
    }

    async function appAlert(mensaje, tipo, titulo) {
        const texto = String(mensaje || '');
        const icono = obtenerIcono(tipo || 'info');
        const encabezado = titulo || (icono === 'error' ? 'Ups' : 'Mensaje');

        if (!tieneSweetAlert()) {
            if (alertaNativa) alertaNativa(texto);
            return;
        }

        await window.Swal.fire({
            title: encabezado,
            text: texto,
            icon: icono,
            confirmButtonText: 'Entendido'
        });
    }

    async function appToast(mensaje, tipo) {
        const texto = String(mensaje || '');
        const icono = obtenerIcono(tipo || 'success');

        if (!tieneSweetAlert()) {
            if (alertaNativa) alertaNativa(texto);
            return;
        }

        await window.Swal.fire({
            toast: true,
            position: 'top-end',
            icon: icono,
            title: texto,
            showConfirmButton: false,
            timer: 2200,
            timerProgressBar: true
        });
    }

    async function appConfirm(opciones) {
        const config = opciones || {};
        const titulo = config.titulo || 'Confirmar accion';
        const texto = config.mensaje || 'Deseas continuar?';
        const textoConfirmar = config.textoConfirmar || 'Si, continuar';
        const textoCancelar = config.textoCancelar || 'Cancelar';
        const icono = obtenerIcono(config.tipo || 'warning');

        if (!tieneSweetAlert()) {
            return confirmNativo ? confirmNativo(texto) : true;
        }

        const resultado = await window.Swal.fire({
            title: titulo,
            text: texto,
            icon: icono,
            showCancelButton: true,
            confirmButtonText: textoConfirmar,
            cancelButtonText: textoCancelar,
            reverseButtons: true
        });

        return Boolean(resultado.isConfirmed);
    }

    window.appAlert = appAlert;
    window.appToast = appToast;
    window.appConfirm = appConfirm;

    window.alert = function (mensaje) {
        return appAlert(mensaje, 'info', 'Aviso');
    };
})();