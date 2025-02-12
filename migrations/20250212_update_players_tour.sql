-- Add tour column if it doesn't exist
ALTER TABLE players
ADD COLUMN IF NOT EXISTS tour VARCHAR(100);

-- Add birth_date column if it doesn't exist
ALTER TABLE players
ADD COLUMN IF NOT EXISTS birth_date DATE;
