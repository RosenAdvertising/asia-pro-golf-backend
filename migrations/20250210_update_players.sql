-- Add new columns to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS nationality VARCHAR(100),
ADD COLUMN IF NOT EXISTS languages_spoken TEXT[],
ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(100),
ADD COLUMN IF NOT EXISTS official_website VARCHAR(255),
ADD COLUMN IF NOT EXISTS equipment_sponsor VARCHAR(255);

-- Create player_statistics table
CREATE TABLE IF NOT EXISTS player_statistics (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    scoring_average DECIMAL(4,2),
    top_10_finishes INTEGER,
    tournament_wins INTEGER,
    career_earnings DECIMAL(15,2),
    career_wins INTEGER,
    career_high_ranking INTEGER,
    weeks_at_career_high INTEGER,
    year_end_ranking INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create player_achievements table
CREATE TABLE IF NOT EXISTS player_achievements (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    achievement_name VARCHAR(255),
    achievement_date DATE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create tournament_results table
CREATE TABLE IF NOT EXISTS tournament_results (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    tournament_name VARCHAR(255),
    tournament_date DATE,
    finish_position INTEGER,
    score INTEGER,
    earnings DECIMAL(15,2),
    is_major BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indices for better query performance
CREATE INDEX IF NOT EXISTS idx_player_statistics_player_id ON player_statistics(player_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_player_id ON player_achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_tournament_results_player_id ON tournament_results(player_id);
CREATE INDEX IF NOT EXISTS idx_tournament_results_date ON tournament_results(tournament_date);

-- Add function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
CREATE TRIGGER update_player_statistics_updated_at
    BEFORE UPDATE ON player_statistics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
