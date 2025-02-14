ALTER TABLE players
ADD COLUMN image_url VARCHAR(255);

-- Add an index for faster lookups
CREATE INDEX idx_player_image_url ON players(image_url);
