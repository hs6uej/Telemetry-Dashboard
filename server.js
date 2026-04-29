const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
const port = 2025;

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'db',
  database: 'telemetry',
  password: 'password',
  port: 5432,
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
}));
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (match && user.approved) {
        req.session.user = user;
        // Log login
        await pool.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [user.id, 'login', `User ${username} logged in`]);
        return res.json({ success: true, redirect: '/' });
      } else if (!user.approved) {
        return res.status(401).json({ success: false, error: 'บัญชีนี้ยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ' });
      } else {
        return res.status(401).json({ success: false, error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
      }
    } else {
      return res.status(404).json({ success: false, error: 'ไม่พบชื่อผู้ใช้งานนี้ในระบบ' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Password reset endpoints
app.post('/api/forgot-password', async (req, res) => {
  const { username } = req.body;
  try {
    const result = await pool.query('SELECT id, username FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    
    // Create reset token
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, reset_reason) VALUES ($1, $2, $3)',
      [user.id, token, 'forgot_password']
    );
    
    // Log the action
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'forgot_password_request', `User requested password reset`]
    );
    
    res.json({ 
      message: 'Password reset token generated. Please contact administrator with this token: ' + token.substring(0, 8) + '...',
      token: token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error processing request' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP AND used = FALSE',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    
    const resetToken = result.rows[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await pool.query('UPDATE users SET password = $1, password_reset_required = FALSE WHERE id = $2', 
      [hashedPassword, resetToken.user_id]
    );
    
    // Mark token as used
    await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [resetToken.id]);
    
    // Log the action
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [resetToken.user_id, 'password_reset', 'User reset password']
    );
    
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error resetting password' });
  }
});

// Admin reset user password
app.post('/api/users/:id/reset-password', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  
  const { id } = req.params;
  const { newPassword } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await pool.query(
      'UPDATE users SET password = $1, password_reset_required = FALSE WHERE id = $2 RETURNING username',
      [hashedPassword, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const username = result.rows[0].username;
    
    // Log the action
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.session.user.id, 'admin_reset_password', `Admin reset password for user: ${username}`]
    );
    
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error resetting password' });
  }
});

// Mark user as needing password reset
app.post('/api/users/:id/require-password-reset', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE users SET password_reset_required = TRUE WHERE id = $1 RETURNING username',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.session.user.id, 'require_password_reset', `Marked user for password reset: ${result.rows[0].username}`]
    );
    
    res.json({ message: 'User marked for password reset' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating user' });
  }
});

// Get users needing password reset
app.get('/api/users/pending-password-reset', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  
  try {
    const result = await pool.query(
      'SELECT id, username, created_at FROM users WHERE password_reset_required = TRUE ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching users' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/admin', (req, res) => {
  if (req.session.user && req.session.user.role === 'admin') {
    res.sendFile(__dirname + '/admin.html');
  } else {
    res.redirect('/login');
  }
});

// API for user management
app.get('/api/users', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query('SELECT id, username, role, approved, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching users' });
  }
});

app.post('/api/users/approve/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { id } = req.params;
  try {
    await pool.query('UPDATE users SET approved = TRUE, role = $1 WHERE id = $2', ['user', id]);
    await pool.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.session.user.id, 'approve_user', `Approved user ID: ${id}`]);
    res.json({ message: 'User approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error approving user' });
  }
});

app.post('/api/users', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { username, password, role, approved } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password, role, approved) VALUES ($1, $2, $3, $4) RETURNING id, username, role, approved, created_at',
      [username, hashedPassword, role, approved]
    );
    await pool.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.session.user.id, 'create_user', `Created user: ${username}`]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating user' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const { username, password, role, approved } = req.body;
  try {
    let query, params;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = 'UPDATE users SET username = $1, password = $2, role = $3, approved = $4 WHERE id = $5 RETURNING id, username, role, approved, created_at';
      params = [username, hashedPassword, role, approved, id];
    } else {
      query = 'UPDATE users SET username = $1, role = $2, approved = $3 WHERE id = $4 RETURNING id, username, role, approved, created_at';
      params = [username, role, approved, id];
    }
    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
    } else {
      await pool.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.session.user.id, 'update_user', `Updated user: ${username}`]);
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating user' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    await pool.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.session.user.id, 'delete_user', `Deleted user ID: ${id}`]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting user' });
  }
});

// API for activity logs
app.get('/api/logs', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query(`
      SELECT l.*, u.username as user_name
      FROM activity_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.timestamp DESC LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching logs' });
  }
});

app.post('/api/logs/clear', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    await pool.query("DELETE FROM activity_logs WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '30 days'");
    await pool.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.session.user.id, 'clear_logs', 'Cleared logs older than 30 days']);
    res.json({ message: 'Old logs cleared' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error clearing logs' });
  }
});

// API for session info
app.get('/api/session', (req, res) => {
  res.json({ user: req.session.user || null });
});

// API for telemetry data
app.get('/api/stations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stations');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching stations' });
  }
});

// API POST - Add new station
app.post('/api/stations', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { name, lat, lng, left_bank, right_bank, bed_data, warning_level } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO stations (name, lat, lng, left_bank, right_bank, bed_data, warning_level, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [name, lat, lng, left_bank, right_bank, bed_data, warning_level, 'normal']
    );
    await pool.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.session.user.id, 'add_station', `Added station: ${name}`]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating station' });
  }
});

// API PUT - Update station
app.put('/api/stations/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const { name, lat, lng, water_level, rain_level, status, left_bank, right_bank, bed_data, warning_level } = req.body;
  try {
    const result = await pool.query(
      'UPDATE stations SET name = $1, lat = $2, lng = $3, water_level = $4, rain_level = $5, status = $6, left_bank = $7, right_bank = $8, bed_data = $9, warning_level = $10, updated_at = CURRENT_TIMESTAMP WHERE id = $11 RETURNING *',
      [name, lat, lng, water_level, rain_level, status, left_bank, right_bank, bed_data, warning_level, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Station not found' });
    } else {
      await pool.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.session.user.id, 'update_station', `Updated station: ${name}`]);
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating station' });
  }
});

// API DELETE - Delete station
app.delete('/api/stations/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM stations WHERE id = $1 RETURNING name', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Station not found' });
    } else {
      await pool.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.session.user.id, 'delete_station', `Deleted station: ${result.rows[0].name}`]);
      res.json({ message: 'Station deleted' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting station' });
  }
});

// API for public users - 7 days data
app.get('/api/stations/public', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, lat, lng, water_level, rain_level, status, updated_at
      FROM stations
      WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      ORDER BY updated_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching public data' });
  }
});

// API for API configurations
app.get('/api/configs', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query('SELECT * FROM api_configs ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching API configs' });
  }
});

app.post('/api/configs', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { name, api_endpoint, api_key, send_interval, enabled } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO api_configs (name, api_endpoint, api_key, send_interval, enabled) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, api_endpoint, api_key, send_interval, enabled]
    );
    await pool.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.session.user.id, 'add_api_config', `Added API config: ${name}`]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating API config' });
  }
});

app.put('/api/configs/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const { name, api_endpoint, api_key, send_interval, enabled } = req.body;
  try {
    const result = await pool.query(
      'UPDATE api_configs SET name = $1, api_endpoint = $2, api_key = $3, send_interval = $4, enabled = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
      [name, api_endpoint, api_key, send_interval, enabled, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'API config not found' });
    } else {
      await pool.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.session.user.id, 'update_api_config', `Updated API config: ${name}`]);
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating API config' });
  }
});

app.delete('/api/configs/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM api_configs WHERE id = $1 RETURNING name', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'API config not found' });
    } else {
      await pool.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.session.user.id, 'delete_api_config', `Deleted API config: ${result.rows[0].name}`]);
      res.json({ message: 'API config deleted' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting API config' });
  }
});

// API to send data to configured endpoints
app.post('/api/configs/:id/send', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { id } = req.params;
  try {
    const configResult = await pool.query('SELECT * FROM api_configs WHERE id = $1', [id]);
    if (configResult.rows.length === 0) {
      return res.status(404).json({ error: 'API config not found' });
    }
    const config = configResult.rows[0];

    // Get all stations data
    const stationsResult = await pool.query('SELECT * FROM stations');
    const data = {
      timestamp: new Date().toISOString(),
      stations: stationsResult.rows
    };

    // Send to API endpoint (simulated)
    console.log(`Sending data to ${config.api_endpoint}:`, data);

    // Update last_sent timestamp
    await pool.query('UPDATE api_configs SET last_sent = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    await pool.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.session.user.id, 'send_data', `Sent data to API: ${config.name}`]);

    res.json({ message: 'Data sent successfully', config: config.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error sending data' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});