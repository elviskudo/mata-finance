-- Migration: Add precheck_report column to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS precheck_report JSONB;

-- Update existing records if needed (optional)
-- UPDATE transactions SET precheck_report = '{}' WHERE precheck_report IS NULL;