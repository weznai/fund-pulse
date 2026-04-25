-- Migration: Add status column to user_funds table
-- Date: 2026-03-26
-- Description: Add soft delete support for user_funds
--   status = 'a' : Active (normal)
--   status = 'd' : Deleted

-- Add status column with default value 'a'
ALTER TABLE user_funds ADD COLUMN status VARCHAR(1) NOT NULL DEFAULT 'a';

-- Update existing records to ensure they have the default value
UPDATE user_funds SET status = 'a' WHERE status IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_funds_status ON user_funds(user_id, status);
