const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

function obtenerCredencialesFirebase() {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (serviceAccountJson) {
        try {
            return JSON.parse(serviceAccountJson);
        } catch (error) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no es un JSON valido.');
        }
    }

    if (projectId && clientEmail && privateKey) {
        return {
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n')
        };
    }

    const keyPath = path.join(__dirname, '..', 'firebase-key.json');
    if (fs.existsSync(keyPath)) {
        return require(keyPath);
    }

    throw new Error('Faltan credenciales de Firebase. Configura FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY o agrega firebase-key.json localmente.');
}

let db = null;
let firebaseInitError = null;

try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(obtenerCredencialesFirebase()),
            databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://carrito-compras-2f7d7.firebaseio.com'
        });
    }

    db = admin.firestore();
    db.settings({ preferRest: true });
} catch (error) {
    firebaseInitError = error;
}

module.exports = {
    admin,
    db,
    firebaseInitError
};