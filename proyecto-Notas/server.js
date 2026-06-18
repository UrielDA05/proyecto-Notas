console.log("🚀 INICIANDO VERSIÓN DEFINITIVA DEL SERVER...");
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'Proyecto notas')));

let pool;
let emailTransporter;

// ======================
// CONFIGURACIÓN EMAIL
// ======================
const MI_GMAIL = process.env.EMAIL_USER;
const MI_PASSWORD_APP = process.env.EMAIL_PASS;

const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${process.env.PORT || 3000}`;

// ======================
// INICIALIZACIÓN
// ======================
async function initServer() {
    try {
        const dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };

        pool = mysql.createPool(dbConfig);
        await pool.query('SELECT 1');
        console.log('🐬 Conectado a la base de datos MySQL (Clever Cloud).');

        // Configurar correo (SIN BLOQUEAR EL ARRANQUE)
        emailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: MI_GMAIL,
                pass: MI_PASSWORD_APP
            }
        });
        console.log('📧 Configuración de SMTP cargada en memoria.');

        // Crear tablas si no existen
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                verified BOOLEAN DEFAULT FALSE,
                token VARCHAR(255)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                title VARCHAR(255),
                content TEXT,
                color VARCHAR(50),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Tablas verificadas.');

    } catch (error) {
        console.error('❌ Error inicializando base de datos:', error);
    }
}

// ======================
// RUTAS (API)
// ======================

app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const token = crypto.randomBytes(32).toString('hex');

        await pool.query(
            'INSERT INTO users (username,email,password,token) VALUES (?,?,?,?)',
            [username, email, password, token]
        );

        const verificationLink = `${BASE_URL}/api/verify?token=${token}`;

        const mailOptions = {
            from: MI_GMAIL,
            to: email,
            subject: 'Verificación de Correo - Proyecto Notas',
            html: `
                <h2>Hola ${username}</h2>
                <p>Verifica tu cuenta haciendo clic en el siguiente enlace:</p>
                <a href="${verificationLink}">Verificar Cuenta</a>
            `
        };

        console.log('📨 Intentando enviar correo a:', email);
        const info = await emailTransporter.sendMail(mailOptions);
        console.log('✅ Correo enviado con éxito:', info.messageId);

        res.json({ message: 'Usuario registrado. Revisa tu correo.' });

    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El correo ya está registrado.' });
        }
        res.status(500).json({ error: 'Error en el servidor durante el registro.' });
    }
});

app.get('/api/verify', async (req, res) => {
    const { token } = req.query;
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE token = ?', [token]);
        if (users.length === 0) {
            return res.status(400).send('Token inválido.');
        }

        await pool.query('UPDATE users SET verified = TRUE, token = NULL WHERE id = ?', [users[0].id]);

        res.send(`
            <div style="font-family:sans-serif;text-align:center;margin-top:50px;">
                <h1>✅ Cuenta verificada</h1>
                <p>Ya puedes iniciar sesión.</p>
                <a href="${BASE_URL}">Volver a la aplicación</a>
            </div>
        `);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error verificando cuenta.');
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
        if (users.length === 0) {
            return res.status(400).json({ error: 'Credenciales incorrectas.' });
        }
        if (!users[0].verified) {
            return res.status(400).json({ error: 'Debes verificar tu correo.' });
        }

        res.json({
            message: 'Inicio de sesión exitoso.',
            userId: users[0].id,
            username: users[0].username
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el inicio de sesión.' });
    }
});

app.post('/api/recover', async (req, res) => {
    const { email } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).json({ error: 'Correo no registrado.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        await pool.query('UPDATE users SET token = ? WHERE id = ?', [token, users[0].id]);

        const recoveryLink = `${BASE_URL}/recuperar.html?token=${token}`;

        const mailOptions = {
            from: MI_GMAIL,
            to: email,
            subject: 'Recuperación de Contraseña',
            html: `
                <p>Haz clic en el siguiente enlace para recuperar tu contraseña:</p>
                <a href="${recoveryLink}">Recuperar Contraseña</a>
            `
        };

        const info = await emailTransporter.sendMail(mailOptions);
        console.log('✅ Correo recuperación:', info.messageId);

        res.json({ message: 'Correo de recuperación enviado.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error procesando recuperación.' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE token = ?', [token]);
        if (users.length === 0) {
            return res.status(400).json({ error: 'Token inválido.' });
        }

        await pool.query('UPDATE users SET password = ?, token = NULL WHERE id = ?', [newPassword, users[0].id]);
        res.json({ message: 'Contraseña actualizada.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error actualizando contraseña.' });
    }
});

app.get('/api/notes', async (req, res) => {
    const userId = req.headers['user-id'];
    const [notes] = await pool.query('SELECT * FROM notes WHERE user_id = ?', [userId]);
    res.json(notes);
});

app.post('/api/notes', async (req, res) => {
    const { title, content, color, userId } = req.body;
    await pool.query('INSERT INTO notes (user_id,title,content,color) VALUES (?,?,?,?)', [userId, title, content, color]);
    res.json({ message: 'Nota creada.' });
});

app.put('/api/notes/:id', async (req, res) => {
    const { title, content, color } = req.body;
    await pool.query('UPDATE notes SET title=?, content=?, color=? WHERE id=?', [title, content, color, req.params.id]);
    res.json({ message: 'Nota actualizada.' });
});

app.delete('/api/notes/:id', async (req, res) => {
    await pool.query('DELETE FROM notes WHERE id=?', [req.params.id]);
    res.json({ message: 'Nota eliminada.' });
});

// ======================
// ARRANQUE RAPIDO
// ======================
const PORT = process.env.PORT || 3000;

initServer().then(() => {
    // Encendemos el puerto inmediatamente
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 SERVIDOR LISTO Y ESCUCHANDO EN EL PUERTO ${PORT}`);
    });
});