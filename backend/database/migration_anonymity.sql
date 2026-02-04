-- Migration: Add anonymity support for multi-user system
-- Each user has a public_alias that others see instead of real name

-- Add public_alias column (human-readable anonymous identifier)
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_alias VARCHAR(20);

-- Add index for login_id lookups
CREATE INDEX IF NOT EXISTS idx_users_login_id ON users(login_id);

-- Create function to generate random alias
CREATE OR REPLACE FUNCTION generate_public_alias(role_prefix VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    random_num INTEGER;
    alias_exists BOOLEAN;
    new_alias VARCHAR(20);
BEGIN
    LOOP
        random_num := floor(random() * 9000 + 1000)::INTEGER;
        new_alias := role_prefix || '-' || random_num;
        
        SELECT EXISTS(SELECT 1 FROM users WHERE public_alias = new_alias) INTO alias_exists;
        
        IF NOT alias_exists THEN
            RETURN new_alias;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update existing users with public_alias if NULL
UPDATE users 
SET public_alias = generate_public_alias(
    CASE 
        WHEN role = 'admin_finance' THEN 'FIN'
        WHEN role = 'approval' THEN 'APR'
        ELSE 'USR'
    END
)
WHERE public_alias IS NULL;

-- Make public_alias NOT NULL and UNIQUE after migration
ALTER TABLE users ALTER COLUMN public_alias SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_public_alias_unique UNIQUE (public_alias);

-- Update login_id for existing users if NULL
UPDATE users SET login_id = uuid_generate_v4() WHERE login_id IS NULL;
ALTER TABLE users ALTER COLUMN login_id SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_login_id_unique UNIQUE (login_id);

-- Insert sample approval users for testing
INSERT INTO users (id, email, password, full_name, role, department, login_id, public_alias) VALUES
    (uuid_generate_v4(), 'approval1@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4EdAYyAe4jvPLKWm', 'Approval Officer 1', 'approval', 'Approval', uuid_generate_v4(), generate_public_alias('APR')),
    (uuid_generate_v4(), 'approval2@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4EdAYyAe4jvPLKWm', 'Approval Officer 2', 'approval', 'Approval', uuid_generate_v4(), generate_public_alias('APR'))
ON CONFLICT (email) DO NOTHING;

-- Insert sample admin finance users for testing  
INSERT INTO users (id, email, password, full_name, role, department, login_id, public_alias) VALUES
    (uuid_generate_v4(), 'finance1@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4EdAYyAe4jvPLKWm', 'Finance Admin 1', 'admin_finance', 'Finance', uuid_generate_v4(), generate_public_alias('FIN')),
    (uuid_generate_v4(), 'finance2@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4EdAYyAe4jvPLKWm', 'Finance Admin 2', 'admin_finance', 'Finance', uuid_generate_v4(), generate_public_alias('FIN'))
ON CONFLICT (email) DO NOTHING;

-- Note: Test password for all sample users is 'password123'
