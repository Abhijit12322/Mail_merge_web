require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { initDb, dbRun, dbGet } = require('./database');
const sendEmailHandler = require('./api/send-email');

const app = express();

// Initialize database
initDb().catch(err => {
  console.error('Failed to initialize database:', err);
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Authentication API Routes

// 1. Register User
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const existingUser = await dbGet('SELECT * FROM users WHERE username = ? OR (email IS NOT NULL AND email = ?)', [username, email || null]);
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    await dbRun('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, email || null, passwordHash]);
    return res.status(201).json({ success: true, message: 'User registered successfully.' });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Database error occurred during registration.' });
  }
});

// 1b. Signup Start (sends email verification code to the host email only)
app.post('/api/auth/signup-start', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required.' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    // Check if user already exists
    const existingUser = await dbGet('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this username or email already exists.' });
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Check that SMTP is configured internally
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({ error: 'Server SMTP settings are not configured in environment variables. Cannot send verification email.' });
    }

    // Send verification email to the host email only
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    const mailOptions = {
      from: `"IEEE MergeMail" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // Sent to the host email only
      subject: 'IEEE MergeMail - Account Registration Approval Request',
      html: `
        <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 30px; background-color: #090a0f; color: #f8fafc; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; max-width: 480px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <div style="text-align: center; margin-bottom: 25px;">
            <h1 style="font-size: 1.8rem; font-weight: 700; margin: 0; color: #ffffff; letter-spacing: -0.5px;">IEEE Merge<span style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Mail</span></h1>
            <p style="font-size: 0.8rem; color: #94a3b8; margin: 5px 0 0 0;">New Signup Verification Request</p>
          </div>
          <div style="background-color: rgba(22, 25, 41, 0.7); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <p style="font-size: 0.95rem; color: #f8fafc; margin: 0 0 10px 0; font-weight: 600;">A user has requested to register an account:</p>
            <p style="font-size: 0.85rem; color: #94a3b8; margin: 0 0 5px 0;"><strong>Username:</strong> ${username}</p>
            <p style="font-size: 0.85rem; color: #94a3b8; margin: 0 0 15px 0;"><strong>Email:</strong> ${email}</p>
            <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 15px;">
              <p style="font-size: 0.85rem; color: #94a3b8; margin: 0 0 10px 0;">Provide the verification code below to the user to approve their registration:</p>
              <div style="font-size: 2.2rem; font-weight: 800; color: #6366f1; letter-spacing: 8px; padding: 8px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 6px; display: inline-block; min-width: 180px; text-align: center;">${code}</div>
            </div>
          </div>
          <p style="font-size: 0.75rem; color: #64748b; text-align: center; margin: 0;">This code is valid for 10 minutes. If you wish to deny this request, simply ignore this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    // Save/update pending registration details
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes expiration
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await dbRun('DELETE FROM pending_users WHERE email = ?', [email]);
    await dbRun(
      'INSERT INTO pending_users (email, username, password_hash, verification_code, expires_at) VALUES (?, ?, ?, ?, ?)',
      [email, username, passwordHash, code, expiresAt]
    );

    return res.status(200).json({ success: true, message: 'Verification code has been sent to the host email for approval.' });
  } catch (err) {
    console.error('Signup start error:', err);
    return res.status(500).json({ error: 'Failed to send verification request. Please check server configs or try again later.' });
  }
});

// 1c. Signup Verify (verifies code, creates user and session)
app.post('/api/auth/signup-verify', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  try {
    const pending = await dbGet('SELECT * FROM pending_users WHERE email = ?', [email]);
    if (!pending) {
      return res.status(400).json({ error: 'No verification session found for this email. Please sign up again.' });
    }

    // Check expiry
    const now = new Date();
    const expiry = new Date(pending.expires_at);
    if (expiry < now) {
      await dbRun('DELETE FROM pending_users WHERE email = ?', [email]);
      return res.status(400).json({ error: 'Verification code has expired. Please sign up again.' });
    }

    if (pending.verification_code !== code.trim()) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    // Insert user into main users table with both username and email
    await dbRun(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [pending.username, pending.email, pending.password_hash]
    );

    // Delete from pending table
    await dbRun('DELETE FROM pending_users WHERE email = ?', [email]);

    // Query newly created user
    const newUser = await dbGet('SELECT * FROM users WHERE email = ?', [email]);

    // Generate login session token
    const token = crypto.randomBytes(32).toString('hex');
    await dbRun(
      'INSERT INTO sessions (user_id, token, login_time, last_active_time) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [newUser.id, token]
    );

    return res.status(200).json({ success: true, token, username: newUser.username });
  } catch (err) {
    console.error('Signup verify error:', err);
    return res.status(500).json({ error: 'Failed to verify account. Please try again.' });
  }
});

// 2. Login User
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required.' });
  }

  try {
    // Query by username or email
    const user = await dbGet('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid username/email or password.' });
    }
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username/email or password.' });
    }
    
    // Generate session token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Save session to database
    await dbRun(
      'INSERT INTO sessions (user_id, token, login_time, last_active_time) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [user.id, token]
    );
    
    return res.status(200).json({ success: true, token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Database error occurred during login.' });
  }
});

// 3. Verify Session
app.post('/api/auth/session-check', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required.' });
  }
  try {
    const session = await dbGet(
      'SELECT s.*, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.logout_time IS NULL',
      [token]
    );
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }
    
    // Update active check time
    await dbRun('UPDATE sessions SET last_active_time = CURRENT_TIMESTAMP WHERE id = ?', [session.id]);
    
    return res.status(200).json({ success: true, username: session.username });
  } catch (err) {
    console.error('Session-check error:', err);
    return res.status(500).json({ error: 'Database error occurred during session check.' });
  }
});

// 4. Session Heartbeat (Updates last active time and calculates duration)
app.post('/api/auth/heartbeat', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required.' });
  }
  try {
    const session = await dbGet('SELECT * FROM sessions WHERE token = ? AND logout_time IS NULL', [token]);
    if (!session) {
      return res.status(401).json({ error: 'Session not found or already logged out.' });
    }
    
    // Parse login_time as UTC
    let loginTimeStr = session.login_time;
    if (typeof loginTimeStr === 'string' && !loginTimeStr.endsWith('Z')) {
      loginTimeStr = loginTimeStr.replace(' ', 'T') + 'Z';
    }
    const loginTime = new Date(loginTimeStr);
    const durationSeconds = Math.round((Date.now() - loginTime.getTime()) / 1000);

    // Update active time and duration in a database-agnostic way
    await dbRun(
      'UPDATE sessions SET last_active_time = CURRENT_TIMESTAMP, duration_seconds = ? WHERE id = ?',
      [durationSeconds, session.id]
    );
    
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Heartbeat error:', err);
    return res.status(500).json({ error: 'Database error occurred during heartbeat.' });
  }
});

// 5. Logout User
app.post('/api/auth/logout', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required.' });
  }
  try {
    const session = await dbGet('SELECT * FROM sessions WHERE token = ? AND logout_time IS NULL', [token]);
    if (!session) {
      return res.status(400).json({ error: 'Session not active or already logged out.' });
    }
    
    // Parse login_time as UTC
    let loginTimeStr = session.login_time;
    if (typeof loginTimeStr === 'string' && !loginTimeStr.endsWith('Z')) {
      loginTimeStr = loginTimeStr.replace(' ', 'T') + 'Z';
    }
    const loginTime = new Date(loginTimeStr);
    const durationSeconds = Math.round((Date.now() - loginTime.getTime()) / 1000);

    // Update logout time and final duration in a database-agnostic way
    await dbRun(
      'UPDATE sessions SET logout_time = CURRENT_TIMESTAMP, last_active_time = CURRENT_TIMESTAMP, duration_seconds = ? WHERE id = ?',
      [durationSeconds, session.id]
    );
    
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Database error occurred during logout.' });
  }
});

// Mail Merge API route
app.post('/api/send-email', sendEmailHandler);

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`  Merge Email Server is running on port ${PORT}`);
    console.log(`  Local URL: http://localhost:${PORT}`);
    console.log(`==================================================`);
  });
}

module.exports = app;
