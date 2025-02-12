-- Add tour column to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS tour VARCHAR(100);

-- Update tour information for known players
UPDATE players
SET tour = CASE
    -- Female players (LPGA)
    WHEN last_name IN ('Jutanugarn', 'Tavatanakit', 'Thitikul', 'Suwannapura', 'Anannarukarn', 'Phatlum', 'Meechai') 
    THEN 'LPGA Tour'
    -- Male players
    WHEN last_name IN ('Kaewkanjana', 'Aphibarnrat', 'Jaidee', 'Janewattananond')
    THEN 'Asian Tour'
    ELSE 'Thai Tour'
END;
