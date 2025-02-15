-- Add alternate_names column to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS alternate_names TEXT[];
