const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir la carpeta estática del frontend con el nombre exacto de tu proyecto
app.use(express.static(path.join(__dirname, 'Proyecto notas')));

let db;
let emailTransporter;

// ==================== CONFIGURACIÓN DE GMAIL REAL ====================
// ⚠️ REEMPLAZA ESTOS DOS VALORES CON TUS DATOS DE GOOGLE:
const MI_GMAIL = "proyectonotas6@gmail.com";          // 👈 Tu dirección de Gmail
const MI_PASSWORD_APP = "ktxsbhfliapetnbd";   // 👈 Los 16 caracteres de tu contraseña de aplicación (sin espacios)

// Inicializar Base de Datos y Servidor de Correo de Pruebas (Asíncrono)
async function initServer() {
    db = await open({
        filename: './notas_database.sqlite',
        driver: sqlite3.Database
    });

    // Tablas Relacionales Persistentes en SQLite (Requerimiento de Base de Datos)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            password TEXT,
            verified INTEGER DEFAULT 0,
            token TEXT
        );
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT,
            content TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
    `);

    // Configurar Nodemailer para enviar correos usando tu cuenta real de Gmail
    emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: MI_GMAIL,
            pass: MI_PASSWORD_APP
        }
    });
    
    console.log("💾 Base de datos SQLite y transporte de Gmail inicializados con éxito.");
}

// ================= API AUTENTICACIÓN (PROCESOS ASÍNCRONOS) =================

// Registro de Usuario con Envío de Enlace de Verificación (Punto 5 de la rúbrica)
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const token = crypto.randomBytes(20).toString('hex');
        // Inserción persistente en la Base de Datos
        await db.run('INSERT INTO users (email, password, token) VALUES (?, ?, ?)', [email, password, token]);
        
        const link = `http://${req.headers.host}/api/verify?token=${token}`;
        
        // Envío asíncrono del correo a Gmail
        await emailTransporter.sendMail({
            from: MI_GMAIL, 
            to: email,
            subject: "Verifica tu cuenta de Notas PWA",
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #fe6929; text-align: center;">¡Bienvenido a Notas PWA!</h2>
            <p>Gracias por registrarte. Para activar tu cuenta de forma segura, por favor haz clic en el siguiente botón:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${link}" style="background-color: #2dc7ff; color: white; padding: 12px 25px; text-decoration: none; font-size: 16px; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Activar mi Cuenta</a>
            </div>
            <p style="font-size: 12px; color: #777; text-align: center;">Si el botón no funciona, puedes copiar y pegar este enlace en tu navegador: <br> ${link}</p>
        </div>
        `
});

        console.log(`✉️ Correo de verificación enviado con éxito a: ${email}`);
        res.json({ message: 'Usuario registrado. Por favor, revisa tu bandeja de entrada de Gmail para activar tu cuenta.' });
    } catch (err) {
        res.status(400).json({ error: 'El correo electrónico ya existe o los datos son inválidos.' });
    }
});

// Validación y Activación de la Cuenta (Punto 5.d de la rúbrica)
app.get('/api/verify', async (req, res) => {
    const { token } = req.query;
    const user = await db.get('SELECT * FROM users WHERE token = ?', [token]);
    if (!user) return res.status(400).send('<h1>El enlace de verificación es inválido o ha expirado.</h1>');
    
    // Activa al usuario y limpia el token de un solo uso
    await db.run('UPDATE users SET verified = 1, token = NULL WHERE id = ?', [user.id]);
    res.send('<h1>¡Tu cuenta ha sido activada con éxito! Ya puedes regresar a la PWA e iniciar sesión.</h1>');
});

// Inicio de Sesión / Login (Punto 5.b de la rúbrica)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
    
    if (!user) return res.status(400).json({ error: 'Usuario o contraseña incorrectos.' });
    if (user.verified === 0) return res.status(400).json({ error: 'Debes verificar primero tu cuenta desde el enlace enviado a tu Gmail.' });
    
    res.json({ message: '¡Inicio de sesión exitoso!', userId: user.id, email: user.email });
});

// Recuperación de Contraseña - Solicitar enlace (Punto 6 de la rúbrica)
app.post('/api/recover', async (req, res) => {
    const { email } = req.body;
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(400).json({ error: 'El correo electrónico ingresado no está registrado.' });

    const token = crypto.randomBytes(20).toString('hex');
    await db.run('UPDATE users SET token = ? WHERE id = ?', [token, user.id]);
    
    // Enlace que redirige de vuelta al index.html con el parámetro de recuperación
    const link = `http://${req.headers.host}/index.html?recoverToken=${token}`;

    await emailTransporter.sendMail({
    from: MI_GMAIL, 
    to: email,
    subject: "Recuperación de Contraseña - Notas PWA",
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #fe6929; text-align: center;">Restablecer Contraseña</h2>
        <p>Hemos recibido una solicitud para cambiar tu contraseña. Haz clic en el botón de abajo para configurar una nueva:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${link}" style="background-color: #fe6929; color: white; padding: 12px 25px; text-decoration: none; font-size: 16px; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Cambiar Contraseña</a>
        </div>
        <p style="font-size: 12px; color: #777; text-align: center;">Si no solicitaste este cambio, puedes ignorar este correo con total seguridad.</p>
    </div>
    `
});

    console.log(`🔑 Enlace de recuperación enviado con éxito a: ${email}`);
    res.json({ message: 'Enlace enviado correctamente. Abre tu Gmail para restablecer tu contraseña.' });
});

// Cambiar la contraseña usando el Token de recuperación (Punto 6)
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    const user = await db.get('SELECT * FROM users WHERE token = ?', [token]);
    if (!user) return res.status(400).json({ error: 'El token de recuperación es inválido o ya ha sido utilizado.' });

    await db.run('UPDATE users SET password = ?, token = NULL WHERE id = ?', [newPassword, user.id]);
    res.json({ message: 'Contraseña actualizada con éxito. Ya puedes iniciar sesión.' });
});

// ================= API OPERACIONES CRUD DE NOTAS (PUNTO 3 Y 4) =================

// READ (Consulta de datos asíncrona)
app.get('/api/notes', async (req, res) => {
    const userId = req.headers['user-id'];
    const notes = await db.all('SELECT * FROM notes WHERE user_id = ?', [userId]);
    res.json(notes);
});

// CREATE (Inserción asíncrona)
app.post('/api/notes', async (req, res) => {
    const { title, content, userId } = req.body;
    await db.run('INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)', [userId, title, content]);
    res.json({ message: 'Nota guardada exitosamente.' });
});

// DELETE (Eliminación asíncrona)
app.delete('/api/notes/:id', async (req, res) => {
    await db.run('DELETE FROM notes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Nota eliminada correctamente.' });
});

// ================= RUTA DE AUDITORÍA DE BASE DE DATOS (NIVEL LOCAL) =================
app.get('/api/debug-users', async (req, res) => {
    try {
        const usuarios = await db.all('SELECT id, email, verified, token FROM users');
        res.json(usuarios);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Iniciar el Servidor Integrado
const PORT = 3000;
initServer().then(() => {
    app.listen(PORT, () => console.log(`🚀 Servidor corriendo sin errores en: http://localhost:${PORT}`));
});