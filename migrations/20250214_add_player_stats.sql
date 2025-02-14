-- Add new statistics fields to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS earnings_rank INTEGER,
ADD COLUMN IF NOT EXISTS scoring_average DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS driving_accuracy DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS gir_percentage DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS putts_per_round DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS sand_saves DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS birdies_per_round DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS events_played INTEGER,
ADD COLUMN IF NOT EXISTS cuts_made INTEGER,
ADD COLUMN IF NOT EXISTS top_10s INTEGER,
ADD COLUMN IF NOT EXISTS wins INTEGER,
ADD COLUMN IF NOT EXISTS world_rank INTEGER;

-- Drop the separate player_statistics table since we're moving everything to players
DROP TABLE IF EXISTS player_statistics;
