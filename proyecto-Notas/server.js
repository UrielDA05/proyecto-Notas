const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'Proyecto notas')));

let db;
let emailTransporter;

const MI_GMAIL = "proyectonotas6@gmail.com";
const MI_PASSWORD_APP = "aiwszhvszzycuntm";

async function initServer() {
    const dbConfig = process.env.RENDER ? {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    } : {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'notas_pwa',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };

    pool = mysql.createPool(dbConfig);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE,
            password VARCHAR(255),
            verified INT DEFAULT 0,
            token VARCHAR(255)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS notes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            title VARCHAR(255),
            content TEXT,
            color VARCHAR(50) DEFAULT '#2dc7ff',
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: MI_GMAIL,
            pass: MI_PASSWORD_APP
        }
    });
    
    console.log("🐬 Servidor conectado a un Pool estable de MySQL.");
}

app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const token = crypto.randomBytes(20).toString('hex');
        
        // Usamos pool.query
        await pool.query('INSERT INTO users (email, password, verified, token) VALUES (?, ?, 0, ?)', [email, password, token]);
        
        const link = `http://${req.headers.host}/api/verify?token=${token}`;
        
        await emailTransporter.sendMail({
            from: MI_GMAIL, 
            to: email,
            subject: "Verifica tu cuenta de Notas PWA",
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #fe6929; text-align: center;">¡Bienvenido a Notas !</h2>
                <p>Para activar tu cuenta de forma segura, por favor haz clic en el siguiente botón:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${link}" style="background-color: #2dc7ff; color: white; padding: 12px 25px; text-decoration: none; font-size: 16px; border-radius: 8px; font-weight: bold; display: inline-block;">Activar mi Cuenta</a>
                </div>
            </div>
            `
        });

        res.json({ message: 'Usuario registrado. Por favor, revisa tu Gmail para activar tu cuenta.' });
    } catch (err) {
        console.error("❌ Error en registro:", err);
        res.status(400).json({ error: 'El correo electrónico ya existe o los datos son inválidos.' });
    }
});

app.get('/api/verify', async (req, res) => {
    const { token } = req.query;
    const [users] = await pool.query('SELECT * FROM users WHERE token = ?', [token]);
    
    if (users.length === 0) {
        return res.status(400).send('<h1>El enlace de verificación es inválido.</h1>');
    }
    
    await pool.query('UPDATE users SET verified = 1, token = NULL WHERE id = ?', [users[0].id]);
    res.redirect('/index.html');
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
    
    if (users.length === 0) return res.status(400).json({ error: 'Usuario o contraseña incorrectos.' });
    if (users[0].verified === 0) return res.status(400).json({ error: 'Debes verificar primero tu cuenta.' });
    
    res.json({ message: '¡Inicio de sesión exitoso!', userId: users[0].id, email: users[0].email });
});

app.post('/api/recover', async (req, res) => {
    const { email } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.status(400).json({ error: 'El correo electrónico no está registrado.' });

    const token = crypto.randomBytes(20).toString('hex');
    await pool.query('UPDATE users SET token = ? WHERE id = ?', [token, users[0].id]);
    
    const link = `http://${req.headers.host}/recuperar.html?recoverToken=${token}`;

    await emailTransporter.sendMail({
        from: MI_GMAIL, 
        to: email,
        subject: "Recuperación de Contraseña - Notas PWA",
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2>Restablecer Contraseña</h2>
            <a href="${link}">Cambiar Contraseña</a>
        </div>
        `
    });

    res.json({ message: 'Enlace enviado correctamente.' });
});

app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE token = ?', [token]);
    if (users.length === 0) return res.status(400).json({ error: 'El token de recuperación es inválido.' });

    await pool.query('UPDATE users SET password = ?, token = NULL WHERE id = ?', [newPassword, users[0].id]);
    res.json({ message: 'Contraseña actualizada con éxito.' });
});

app.get('/api/notes', async (req, res) => {
    const userId = req.headers['user-id'];
    const [notes] = await pool.query('SELECT * FROM notes WHERE user_id = ?', [userId]);
    res.json(notes);
});

app.post('/api/notes', async (req, res) => {
    const { title, content, color, userId } = req.body;
    await pool.query('INSERT INTO notes (user_id, title, content, color) VALUES (?, ?, ?, ?)', [userId, title, content, color]);
    res.json({ message: 'Nota guardada exitosamente.' });
});

app.put('/api/notes/:id', async (req, res) => {
    const { title, content, color } = req.body;
    const { id } = req.params;
    await pool.query('UPDATE notes SET title = ?, content = ?, color = ? WHERE id = ?', [title, content, color, id]);
    res.json({ message: 'Nota actualizada correctamente.' });
});

app.delete('/api/notes/:id', async (req, res) => {
    const { id } = req.params;
    await pool.query('DELETE FROM notes WHERE id = ?', [id]);
    res.json({ message: 'Nota eliminada correctamente.' });
});

const PORT = 3000;
initServer().then(() => {
    app.listen(PORT, () => console.log(` Servidor MySQL corriendo en puerto ${PORT}`));
}).catch(err => {
    console.error("Fallo crítico al iniciar base de datos:", err);
});