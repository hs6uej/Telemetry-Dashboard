-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'pending',
  approved BOOLEAN DEFAULT FALSE,
  password_reset_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create password reset tokens table
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  reset_reason VARCHAR(100), -- 'forgot_password' or 'admin_reset'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '1 day',
  used BOOLEAN DEFAULT FALSE
);

-- Create activity_logs table
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  details TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create api_configs table
CREATE TABLE api_configs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  api_endpoint VARCHAR(500) NOT NULL,
  api_key VARCHAR(255),
  send_interval INTEGER DEFAULT 300, -- seconds
  enabled BOOLEAN DEFAULT TRUE,
  last_sent TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create stations table
CREATE TABLE stations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  water_level FLOAT,
  rain_level FLOAT,
  status VARCHAR(20) DEFAULT 'normal',
  left_bank FLOAT,
  right_bank FLOAT,
  bed_data TEXT,
  warning_level FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial admin user (password: 123456 hashed)
INSERT INTO users (username, password, role, approved) VALUES ('admin', '$2b$10$XxZJZJ3RS7tQogKiQm1blexeVd0NpQVyGXToJNLgEj/aE5aMPWefW', 'admin', TRUE);

-- Insert default API configs
INSERT INTO api_configs (name, api_endpoint, api_key, send_interval, enabled) VALUES
('กรมชลฯ API', 'https://api.rid.go.th/api/v1/telemetry', 'your-api-key-here', 300, TRUE),
('ระบบแจ้งเตือนน้ำ', 'https://water-warning-api.example.com/data', '', 600, FALSE);

-- Insert sample stations
INSERT INTO stations (name, lat, lng, water_level, rain_level, status, left_bank, right_bank, bed_data, warning_level) VALUES
('สถานีวัดน้ำ คลองชัยนาท', 15.185, 100.133, 6.52, 0.0, 'normal', 7.0, 7.2, 'ข้อมูลท้องน้ำปกติ', 7.5),
('สถานีวัดน้ำ แม่น้ำยม', 16.820, 100.270, 8.14, 12.6, 'warning', 8.5, 8.7, 'ท้องน้ำลึก', 8.8),
('สถานีวัดน้ำ คลองป่าสัก', 14.800, 100.750, 9.88, 38.2, 'critical', 9.5, 9.7, 'ท้องน้ำตื้น', 9.9),
('สถานีวัดน้ำ แม่น้ำบางปะกง', 13.810, 101.110, 2.30, 0.0, 'normal', 5.0, 5.2, 'ไม่ทราบค่า', 5.5),
('สถานีวัดน้ำ แม่น้ำกก', 19.908, 99.834, NULL, NULL, 'offline', 6.0, 6.2, 'ไม่ทราบค่า', 6.5);