const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY;
const SPORTRADAR_BASE_URL = 'https://api.sportradar.com/golf/trial';

// Map of tour codes to their full names
const TOURS = {
    'pga': 'PGA Tour',
    'lpga': 'LPGA',
    'champ': 'PGA Tour Champions',
    'euro': 'PGA European Tour',
    'liv': 'LIV Golf',
    'pgad': 'Korn Ferry Tour',
    'oly': 'Olympics'
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function updatePlayerData() {
    try {
        console.log('Starting player data update...');
        
        for (const [tourCode, tourName] of Object.entries(TOURS)) {
            console.log(`Checking ${tourName} (${tourCode}) for Thai players...`);
            
            try {
                // Get player profiles for the specific tour
                const profilesUrl = `${SPORTRADAR_BASE_URL}/${tourCode}/v3/en/2023/players/profiles.json?api_key=${SPORTRADAR_API_KEY}`;
                console.log('Requesting:', profilesUrl);
                
                const { data: tourData } = await axios.get(profilesUrl);

                if (!tourData.players) {
                    console.log(`No players found in ${tourName}`);
                    continue;
                }

                // Filter for Thai players
                const thaiPlayers = tourData.players.filter(player => 
                    player.country?.toLowerCase() === 'tha' || 
                    player.nationality?.toLowerCase() === 'tha' ||
                    player.country?.toLowerCase() === 'thailand' ||
                    player.nationality?.toLowerCase() === 'thailand'
                );

                console.log(`Found ${thaiPlayers.length} Thai players in ${tourName}`);
                console.log('Thai players:', thaiPlayers.map(p => `${p.first_name} ${p.last_name}`));

                // Insert each Thai player
                for (const player of thaiPlayers) {
                    try {
                        console.log('Inserting player:', player);
                        await pool.query(`
                            INSERT INTO players (
                                id, first_name, last_name, country, height, weight,
                                birth_place, residence, college, tour, alias,
                                abbr_name, handedness, turned_pro, member,
                                birthday, updated_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
                            ON CONFLICT (id) DO UPDATE SET
                                first_name = EXCLUDED.first_name,
                                last_name = EXCLUDED.last_name,
                                country = EXCLUDED.country,
                                height = EXCLUDED.height,
                                weight = EXCLUDED.weight,
                                birth_place = EXCLUDED.birth_place,
                                residence = EXCLUDED.residence,
                                college = EXCLUDED.college,
                                tour = EXCLUDED.tour,
                                alias = EXCLUDED.alias,
                                abbr_name = EXCLUDED.abbr_name,
                                handedness = EXCLUDED.handedness,
                                turned_pro = EXCLUDED.turned_pro,
                                member = EXCLUDED.member,
                                birthday = EXCLUDED.birthday,
                                updated_at = CURRENT_TIMESTAMP
                        `, [
                            player.id,
                            player.first_name,
                            player.last_name,
                            player.country,
                            player.height,
                            player.weight,
                            player.birth_place,
                            player.residence,
                            player.college,
                            tourName,
                            player.alias,
                            player.abbr_name,
                            player.handedness,
                            player.turned_pro,
                            player.member,
                            player.birthday
                        ]);

                        console.log(`Updated Thai player: ${player.first_name} ${player.last_name} (${tourName})`);
                    } catch (error) {
                        console.error(`Error updating player ${player.id}:`, error);
                        console.error('Player data:', player);
                    }
                }

                // Add delay between tour requests to respect rate limits
                await sleep(1000);
            } catch (error) {
                if (error.response?.status === 404) {
                    console.error(`Error fetching ${tourName} data: Request failed with status code 404`);
                } else {
                    console.error(`Error fetching ${tourName} data:`, error.message);
                }
                continue;
            }
        }

        console.log('Player data update completed');
    } catch (error) {
        console.error('Error during player update:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run the update if called directly
if (require.main === module) {
    updatePlayerData()
        .then(() => console.log('Update completed successfully'))
        .catch(error => {
            console.error('Update failed:', error);
            process.exit(1);
        });
}
