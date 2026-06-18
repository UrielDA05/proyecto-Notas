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

// Configuración de credenciales de Gmail
const MI_GMAIL = process.env.EMAIL_USER || "proyectonotas6@gmail.com";
const MI_PASSWORD_APP = process.env.EMAIL_PASS || "aiwszhvszzycuntm";

// Configuración dinámica de la URL (Detecta automáticamente si estás en Railway o Local)
const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` 
    : 'http://localhost:3000';

async function initServer() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'notas_pwa',
        port: process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };

    pool = mysql.createPool(dbConfig);

    // Configuración segura para Nodemailer (Evita el bloqueo de IPs en servidores en la nube)
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,            // Usa 587 en lugar de 465 o 25
        secure: false,        // Debe ser false para el puerto 587
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
  }
});
      
    // Inicialización de Tablas Relacionales
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

    console.log('🐬 Servidor conectado a un Pool estable de MySQL.');
}

initServer().catch(err => {
    console.error('❌ Error inicializando el servidor:', err);
});

// --- RUTAS DE LA API ---

// 1. Registro de Usuarios
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const token = crypto.randomBytes(32).toString('hex');
        await pool.query('INSERT INTO users (username, email, password, token) VALUES (?, ?, ?, ?)', [username, email, password, token]);

        const verificationLink = `${BASE_URL}/api/verify?token=${token}`;

        const mailOptions = {
            from: MI_GMAIL,
            to: email,
            subject: 'Verificación de Correo - Proyecto Notas',
            html: `<p>Hola ${username},</p><p>Por favor verifica tu correo haciendo clic en el siguiente enlace:</p><a href="${verificationLink}">${verificationLink}</a>`
        };

        await emailTransporter.sendMail(mailOptions);
        res.json({ message: 'Usuario registrado. Por favor verifica tu correo electrónico.' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
        }
        console.error(err);
        res.status(500).json({ error: 'Error en el servidor durante el registro.' });
    }
});

// 2. Verificación de Cuenta vía Token
app.get('/api/verify', async (req, res) => {
    const { token } = req.query;
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE token = ?', [token]);
        if (users.length === 0) return res.status(400).send('Token inválido o expirado.');

        await pool.query('UPDATE users SET verified = TRUE, token = NULL WHERE id = ?', [users[0].id]);
        
        res.send(`
            <div style="text-align: center; font-family: sans-serif; margin-top: 50px;">
                <h1 style="color: #4CAF50;">¡Cuenta verificada con éxito!</h1>
                <p>Ya puedes regresar a la aplicación e iniciar sesión.</p>
                <a href="${BASE_URL}" style="padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Ir a Iniciar Sesión</a>
            </div>
        `);
    } catch (error) {
        res.status(500).send('Error al verificar la cuenta.');
    }
});

// 3. Inicio de Sesión
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
        if (users.length === 0) return res.status(400).json({ error: 'Credenciales incorrectas.' });
        if (!users[0].verified) return res.status(400).json({ error: 'Por favor, verifica tu correo primero.' });

        res.json({ message: 'Inicio de sesión exitoso.', userId: users[0].id, username: users[0].username });
    } catch (error) {
        res.status(500).json({ error: 'Error en el inicio de sesión.' });
    }
});

// 4. Solicitar Recuperación de Contraseña
app.post('/api/recover', async (req, res) => {
    const { email } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(400).json({ error: 'El correo no está registrado.' });

        const token = crypto.randomBytes(32).toString('hex');
        await pool.query('UPDATE users SET token = ? WHERE id = ?', [token, users[0].id]);

        const recoveryLink = `${BASE_URL}/api/reset-password.html?token=${token}`;

        const mailOptions = {
            from: MI_GMAIL,
            to: email,
            subject: 'Recuperación de Contraseña - Proyecto Notas',
            html: `<p>Hola,</p><p>Puedes restablecer tu contraseña usando el siguiente enlace:</p><a href="${recoveryLink}">${recoveryLink}</a>`
        };

        await emailTransporter.sendMail(mailOptions);
        res.json({ message: 'Correo de recuperación enviado.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al procesar la recuperación.' });
    }
});

// 5. Guardar Nueva Contraseña
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE token = ?', [token]);
        if (users.length === 0) return res.status(400).json({ error: 'El token de recuperación es inválido.' });

        await pool.query('UPDATE users SET password = ?, token = NULL WHERE id = ?', [newPassword, users[0].id]);
        res.json({ message: 'Contraseña actualizada con éxito.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al restablecer la contraseña.' });
    }
});

// --- OPERACIONES DEL CRUD DE NOTAS ---

// Obtener notas de un usuario
app.get('/api/notes', async (req, res) => {
    const userId = req.headers['user-id'];
    const [notes] = await pool.query('SELECT * FROM notes WHERE user_id = ?', [userId]);
    res.json(notes);
});

// Crear una nueva nota
app.post('/api/notes', async (req, res) => {
    const { title, content, color, userId } = req.body;
    await pool.query('INSERT INTO notes (user_id, title, content, color) VALUES (?, ?, ?, ?)', [userId, title, content, color]);
    res.json({ message: 'Nota guardada exitosamente.' });
});

// Actualizar una nota existente
app.put('/api/notes/:id', async (req, res) => {
    const { title, content, color } = req.body;
    const { id } = req.params;
    await pool.query('UPDATE notes SET title = ?, content = ?, color = ? WHERE id = ?', [title, content, color, id]);
    res.json({ message: 'Nota actualizada correctamente.' });
});

// Eliminar una nota
app.delete('/api/notes/:id', async (req, res) => {
    const { id } = req.params;
    await pool.query('DELETE FROM notes WHERE id = ?', [id]);
    res.json({ message: 'Nota eliminada correctamente.' });
});

// Configuración y arranque del Servidor HTTP
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});