import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

const firebaseConfig = {
    apiKey: 'AIzaSyBcPlbcP1eleUdVRNBJL_-KfLBcwsgkbnA',
    authDomain: 'carrito-compras-2f7d7.firebaseapp.com',
    projectId: 'carrito-compras-2f7d7',
    storageBucket: 'carrito-compras-2f7d7.firebasestorage.app',
    messagingSenderId: '1098559719435',
    appId: '1:1098559719435:web:39aff4e7ea0068aae85f0e',
    measurementId: 'G-9D0E71JYFG'
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();
let procesandoSesionGoogle = false;
const CLAVE_LOGIN_GOOGLE_EN_CURSO = 'login_google_en_curso';
let resolviendoLoginGoogle = false;

function esDispositivoMovil() {
    return window.matchMedia('(max-width: 768px)').matches || /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
}

async function guardarSesionGoogle(user) {
    if (procesandoSesionGoogle) {
        return;
    }

    procesandoSesionGoogle = true;
    const nombreCompleto = user.displayName || user.email || 'Usuario';

    try {
        const response = await fetch('/api/google-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombreCompleto,
                correo: user.email,
                fotoURL: user.photoURL || ''
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'No se pudo guardar la sesión de Google');
        }

        localStorage.setItem('sesion_activa', JSON.stringify(data.usuario));
        sessionStorage.removeItem(CLAVE_LOGIN_GOOGLE_EN_CURSO);
        window.location.href = '/index.html';
    } finally {
        procesandoSesionGoogle = false;
    }
}

async function iniciarConGoogle() {
    try {
        localStorage.setItem(CLAVE_LOGIN_GOOGLE_EN_CURSO, '1');

        if (esDispositivoMovil()) {
            await signInWithRedirect(auth, googleProvider);
            return;
        }

        const result = await signInWithPopup(auth, googleProvider);
        await guardarSesionGoogle(result.user);
    } catch (error) {
        localStorage.removeItem(CLAVE_LOGIN_GOOGLE_EN_CURSO);
        alert('No se pudo iniciar con Google: ' + error.message);
    }
}

async function procesarRedireccionGoogle() {
    try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
            await guardarSesionGoogle(result.user);
            return;
        }

        const loginGoogleEnCurso = localStorage.getItem(CLAVE_LOGIN_GOOGLE_EN_CURSO) === '1';
        if (loginGoogleEnCurso && auth.currentUser) {
            await guardarSesionGoogle(auth.currentUser);
        }
    } catch (error) {
        alert('No se pudo completar el inicio con Google: ' + error.message);
    }
}

async function esperarUsuarioAutenticado(maxIntentos = 15, intervaloMs = 300) {
    for (let intento = 0; intento < maxIntentos; intento += 1) {
        if (auth.currentUser) {
            return auth.currentUser;
        }

        await new Promise((resolve) => setTimeout(resolve, intervaloMs));
    }

    return null;
}

async function resolverLoginGooglePendiente() {
    if (resolviendoLoginGoogle) {
        return;
    }

    if (localStorage.getItem(CLAVE_LOGIN_GOOGLE_EN_CURSO) !== '1' || localStorage.getItem('sesion_activa')) {
        return;
    }

    resolviendoLoginGoogle = true;

    try {
        const usuario = await esperarUsuarioAutenticado();
        if (usuario) {
            await guardarSesionGoogle(usuario);
        }
    } finally {
        resolviendoLoginGoogle = false;
    }
}

onAuthStateChanged(auth, (user) => {
    const loginGoogleEnCurso = localStorage.getItem(CLAVE_LOGIN_GOOGLE_EN_CURSO) === '1';

    if (user && loginGoogleEnCurso && !localStorage.getItem('sesion_activa')) {
        guardarSesionGoogle(user).catch((error) => {
            alert('No se pudo completar el inicio con Google: ' + error.message);
        });
    }
});

window.addEventListener('pageshow', () => {
    resolverLoginGooglePendiente().catch((error) => {
        alert('No se pudo completar el inicio con Google: ' + error.message);
    });
});

// Registro
const fReg = document.getElementById('form-registro');
if (fReg) {
    fReg.onsubmit = async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('nom').value.trim();
        const correo = document.getElementById('cor').value;
        const pass = document.getElementById('pas').value;

        try {
            const response = await fetch('/api/registro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, correo, pass })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Registrado ✅. Ahora inicia sesión.');
                window.location.href = '/views/login.html';
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error en la conexión: ' + error.message);
        }
    };
}

// Login
const fLog = document.getElementById('form-login');
if (fLog) {
    fLog.onsubmit = async (e) => {
        e.preventDefault();
        const correo = document.getElementById('l-cor').value;
        const pass = document.getElementById('l-pas').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo, pass })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('sesion_activa', JSON.stringify(data.usuario));
                alert('Login exitoso ✅');
                window.location.href = '/index.html';
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error en la conexión: ' + error.message);
        }
    };
}

const btnGoogleLogin = document.getElementById('btn-google-login');
if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', iniciarConGoogle);
}

const btnGoogleRegister = document.getElementById('btn-google-register');
if (btnGoogleRegister) {
    btnGoogleRegister.addEventListener('click', iniciarConGoogle);
}

procesarRedireccionGoogle();
resolverLoginGooglePendiente();