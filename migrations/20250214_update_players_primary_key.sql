-- First drop dependent foreign keys
ALTER TABLE player_rankings DROP CONSTRAINT IF EXISTS player_rankings_player_id_fkey;
ALTER TABLE player_social_media DROP CONSTRAINT IF EXISTS player_social_media_player_id_fkey;
ALTER TABLE player_tournament_results DROP CONSTRAINT IF EXISTS player_tournament_results_player_id_fkey;
ALTER TABLE player_tours DROP CONSTRAINT IF EXISTS player_tours_player_id_fkey;
ALTER TABLE player_statistics DROP CONSTRAINT IF EXISTS player_statistics_player_id_fkey;
ALTER TABLE player_achievements DROP CONSTRAINT IF EXISTS player_achievements_player_id_fkey;
ALTER TABLE tournament_results DROP CONSTRAINT IF EXISTS tournament_results_player_id_fkey;

-- Drop primary key constraint
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_pkey;
DROP INDEX IF EXISTS players_id_idx;

-- Add sportradar_id column and copy existing id values if any
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS sportradar_id VARCHAR(255);

-- Update any existing rows (if needed)
UPDATE players 
SET sportradar_id = id::text 
WHERE sportradar_id IS NULL;

-- Make sportradar_id the primary key
ALTER TABLE players 
DROP COLUMN IF EXISTS id CASCADE;

ALTER TABLE players 
RENAME COLUMN sportradar_id TO id;

ALTER TABLE players 
ALTER COLUMN id SET NOT NULL,
ADD PRIMARY KEY (id);

-- Add other fields from Sportradar API
ALTER TABLE players
ADD COLUMN IF NOT EXISTS alias VARCHAR(50),
ADD COLUMN IF NOT EXISTS abbr_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS handedness CHAR(1),
ADD COLUMN IF NOT EXISTS turned_pro INTEGER,
ADD COLUMN IF NOT EXISTS member BOOLEAN,
ADD COLUMN IF NOT EXISTS birthday TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated TIMESTAMP WITH TIME ZONE;

-- Update foreign key columns to VARCHAR(255)
ALTER TABLE player_rankings 
ALTER COLUMN player_id TYPE VARCHAR(255) USING player_id::text;

ALTER TABLE player_social_media 
ALTER COLUMN player_id TYPE VARCHAR(255) USING player_id::text;

ALTER TABLE player_tournament_results 
ALTER COLUMN player_id TYPE VARCHAR(255) USING player_id::text;

ALTER TABLE player_tours 
ALTER COLUMN player_id TYPE VARCHAR(255) USING player_id::text;

ALTER TABLE player_statistics 
ALTER COLUMN player_id TYPE VARCHAR(255) USING player_id::text;

ALTER TABLE player_achievements 
ALTER COLUMN player_id TYPE VARCHAR(255) USING player_id::text;

ALTER TABLE tournament_results 
ALTER COLUMN player_id TYPE VARCHAR(255) USING player_id::text;

-- Re-add foreign key constraints with new primary key
ALTER TABLE player_rankings
ADD CONSTRAINT player_rankings_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

ALTER TABLE player_social_media
ADD CONSTRAINT player_social_media_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

ALTER TABLE player_tournament_results
ADD CONSTRAINT player_tournament_results_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

ALTER TABLE player_tours
ADD CONSTRAINT player_tours_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

ALTER TABLE player_statistics
ADD CONSTRAINT player_statistics_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

ALTER TABLE player_achievements
ADD CONSTRAINT player_achievements_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

ALTER TABLE tournament_results
ADD CONSTRAINT tournament_results_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
