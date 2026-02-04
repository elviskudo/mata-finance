-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin_finance',
    department VARCHAR(100),
    login_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    public_alias VARCHAR(20) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_code VARCHAR(50) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'IDR',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    description TEXT,
    recipient_name VARCHAR(255),
    recipient_account VARCHAR(100),
    due_date TIMESTAMP WITH TIME ZONE,
    invoice_number VARCHAR(100),
    cost_center VARCHAR(100),
    vendor_id UUID,
    ocr_status VARCHAR(50),
    ocr_data JSONB,
    precheck_report JSONB,
    risk_level VARCHAR(20),
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expired_at TIMESTAMP WITH TIME ZONE,
    revision_count INT DEFAULT 0,
    reject_reason TEXT,
    notes TEXT,
    internal_flags JSONB,
    version INT DEFAULT 1,
    is_latest BOOLEAN DEFAULT true,
    UNIQUE(transaction_code, version)
);

-- Index for archival cloning performance
CREATE INDEX idx_transactions_is_latest ON transactions(is_latest);

-- Transaction Items table
CREATE TABLE transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    account_code VARCHAR(50),
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15, 2) NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transaction Documents table
CREATE TABLE transaction_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100),
    file_size INT,
    ocr_status VARCHAR(50) DEFAULT 'pending',
    ocr_result JSONB,
    status_match VARCHAR(20),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Accounting Queue table
CREATE TABLE accounting_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    assigned_to UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SLA Configurations table
CREATE TABLE sla_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_type VARCHAR(50) NOT NULL,
    warning_hours INT NOT NULL DEFAULT 24,
    critical_hours INT NOT NULL DEFAULT 48,
    max_hours INT NOT NULL DEFAULT 72,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Activity Logs table
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Personal Alerts table
CREATE TABLE personal_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    severity VARCHAR(20) DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Exception Cases table
CREATE TABLE exception_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN', -- OPEN, RESOLVED
    allowlist JSONB NOT NULL, -- array of allowed fields to patch
    patch JSONB DEFAULT '{}', -- corrections/patches applied
    mismatch_summary TEXT, -- summary of mismatches
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SOP Content table
CREATE TABLE sop_content (
    id SERIAL PRIMARY KEY,
    context_type VARCHAR(50) NOT NULL, -- 'Input', 'Exception', 'Timeline'
    context_code VARCHAR(50) NOT NULL, -- 'field_locked', 'submit_disabled', 'exception_mismatch'
    role VARCHAR(50) NOT NULL DEFAULT 'admin_finance',
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_due_date ON transactions(due_date);
CREATE INDEX idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_documents_transaction_id ON transaction_documents(transaction_id);
CREATE INDEX idx_accounting_queue_transaction_id ON accounting_queue(transaction_id);
CREATE INDEX idx_accounting_queue_owner_id ON accounting_queue(owner_id);
CREATE INDEX idx_accounting_queue_status ON accounting_queue(status);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX idx_personal_alerts_user_id ON personal_alerts(user_id);
CREATE INDEX idx_personal_alerts_is_read ON personal_alerts(is_read);
CREATE INDEX idx_exception_cases_transaction_id ON exception_cases(transaction_id);
CREATE INDEX idx_exception_cases_user_id ON exception_cases(user_id);
CREATE INDEX idx_exception_cases_status ON exception_cases(status);
CREATE INDEX idx_sop_content_context ON sop_content(context_type, context_code, role);

-- Emergency Requests Table
CREATE TABLE IF NOT EXISTS emergency_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES users(id),
    admin_reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_transaction_id ON emergency_requests(transaction_id);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_status ON emergency_requests(status);

-- System Signals Table (Hidden)
CREATE TABLE IF NOT EXISTS system_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_type VARCHAR(100) NOT NULL,
    signal_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_system_signals_type ON system_signals(signal_type);

-- Insert sample signals
INSERT INTO system_signals (signal_type, signal_data)
VALUES 
('PRESSURE_METRIC', '{"frequency_pattern": "normal", "abuse_likelihood": 0.05, "stress_calibration": 0.2}'),
('GLOBAL_URGENCY', '{"active_emergencies": 5, "system_load": "medium"}');

-- Insert default SLA configurations
INSERT INTO sla_configs (transaction_type, warning_hours, critical_hours, max_hours) VALUES
('payment', 24, 48, 72),
('transfer', 12, 24, 48),
('invoice', 48, 72, 120),
('reimbursement', 24, 48, 96);

-- Insert sample SOP content
INSERT INTO sop_content (context_type, context_code, role, title, content) VALUES
('Input', 'field_locked', 'admin_finance', 'Field Tidak Dapat Diubah', 'Field ini dikunci karena hasil OCR telah diverifikasi. Anda tidak dapat mengubah nominal lebih dari 5% dari hasil OCR. Jika ada kesalahan, gunakan fitur Exception untuk meminta koreksi.'),
('Input', 'submit_disabled', 'admin_finance', 'Tombol Submit Dinonaktifkan', 'Submit dinonaktifkan karena dokumen belum lengkap. Pastikan lampiran invoice asli telah diupload dan nama penerima sesuai dengan dokumen.'),
('Exception', 'exception_mismatch', 'admin_finance', 'Exception Case', 'Exception terjadi ketika ada ketidakcocokan antara input dan dokumen. Anda dapat meminta koreksi pada field tertentu melalui exception case ini.'),
('Timeline', 'deadline_approaching', 'admin_finance', 'Deadline Mendekat', 'Transaksi ini mendekati deadline approval. Pastikan semua dokumen lengkap dan kirim segera untuk menghindari delay.');

-- Insert sample users (password: password123)
-- Password hash for 'password123' using bcrypt
INSERT INTO users (id, email, password, full_name, role, department, login_id, public_alias) VALUES
(uuid_generate_v4(), 'finance1@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4EdAYyAe4jvPLKWm', 'Finance Admin Satu', 'admin_finance', 'Finance', uuid_generate_v4(), 'FIN-1001'),
(uuid_generate_v4(), 'finance2@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4EdAYyAe4jvPLKWm', 'Finance Admin Dua', 'admin_finance', 'Finance', uuid_generate_v4(), 'FIN-1002'),
(uuid_generate_v4(), 'approval1@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4EdAYyAe4jvPLKWm', 'Approval Officer Satu', 'approval', 'Approval', uuid_generate_v4(), 'APR-2001'),
(uuid_generate_v4(), 'approval2@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4EdAYyAe4jvPLKWm', 'Approval Officer Dua', 'approval', 'Approval', uuid_generate_v4(), 'APR-2002');

