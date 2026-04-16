import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

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

async function guardarSesionGoogle(user) {
    const nombreCompleto = user.displayName || user.email || 'Usuario';

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
    window.location.href = '/index.html';
}

async function iniciarConGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        await guardarSesionGoogle(result.user);
    } catch (error) {
        alert('No se pudo iniciar con Google: ' + error.message);
    }
}

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