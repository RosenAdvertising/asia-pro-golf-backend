-- Add gender and birth_date columns to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Create a function to determine gender based on tour
CREATE OR REPLACE FUNCTION update_gender_from_tour()
RETURNS void AS $$
BEGIN
    -- Update gender based on tour participation
    UPDATE players
    SET gender = CASE
        WHEN tour ILIKE '%lpga%' OR 
             tour ILIKE '%ladies%' OR 
             tour ILIKE '%women%' THEN 'female'
        ELSE 'male'
    END
    WHERE gender IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Create an index for birth_date to optimize age-based queries
CREATE INDEX IF NOT EXISTS idx_players_birth_date ON players(birth_date);
CREATE INDEX IF NOT EXISTS idx_players_gender ON players(gender);

-- Comment on columns
COMMENT ON COLUMN players.gender IS 'Player''s gender (male/female)';
COMMENT ON COLUMN players.birth_date IS 'Player''s date of birth';
