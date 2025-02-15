-- Drop existing players table
DROP TABLE IF EXISTS players;

-- Create new players table with all required fields
CREATE TABLE players (
    id VARCHAR(255) PRIMARY KEY,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    country VARCHAR(50),
    height INTEGER,
    weight INTEGER,
    birth_place VARCHAR(255),
    residence VARCHAR(255),
    college VARCHAR(255),
    tour VARCHAR(100),
    alias VARCHAR(255),
    abbr_name VARCHAR(50),
    handedness CHAR(1),
    turned_pro INTEGER,
    member BOOLEAN,
    birthday DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    image_url TEXT,
    bio TEXT,
    profile_image_url VARCHAR(255),
    pga_url TEXT,
    lpga_url TEXT,
    nationality VARCHAR(50),
    languages_spoken VARCHAR(255)[],
    instagram_handle VARCHAR(255),
    official_website VARCHAR(255),
    equipment_sponsor VARCHAR(255),
    gender VARCHAR(10)
);
