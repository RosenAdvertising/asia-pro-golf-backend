-- Drop the separate player_statistics table since we're moving everything to players
DROP TABLE IF EXISTS player_statistics;

-- Update players table with all the fields from the API
ALTER TABLE players
ADD COLUMN IF NOT EXISTS alias VARCHAR(50),
ADD COLUMN IF NOT EXISTS abbr_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS handedness CHAR(1),
ADD COLUMN IF NOT EXISTS turned_pro INTEGER,
ADD COLUMN IF NOT EXISTS member BOOLEAN,
ADD COLUMN IF NOT EXISTS birthday TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated TIMESTAMP WITH TIME ZONE;

-- Rename some columns to match API
ALTER TABLE players 
RENAME COLUMN birth_date TO birthday;
