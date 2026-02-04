-- Migration: Add login_id column to users table
-- Run this if the database already exists and needs the login_id column added

ALTER TABLE users ADD COLUMN login_id UUID;