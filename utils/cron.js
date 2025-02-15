const cron = require('node-cron');
const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY;
const SPORTRADAR_BASE_URL = 'http://api.sportradar.us/golf/trial/v3/en';
const RATE_LIMIT_DELAY = 5000; // 5 seconds between requests

// Map of tour IDs to their API identifiers
const TOUR_IDS = {
    pga: 'pga',
    dpworld: 'euro', // DP World Tour (formerly European Tour)
    lpga: 'lpga',
    champions: 'champions', // PGA Tour Champions
    kornferry: 'korn-ferry',
    liv: 'liv'
};

// Initialize database pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Helper function to add delay between API calls
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to make API calls with retry logic
async function makeApiCall(path, retryCount = 3, delayMs = RATE_LIMIT_DELAY) {
    const url = `${SPORTRADAR_BASE_URL}${path}`;
    console.log('Making request to:', url);
    
    for (let i = 0; i < retryCount; i++) {
        try {
            // Add delay before each API call to respect rate limits
            await delay(delayMs);
            const response = await axios.get(url);
            return response;
        } catch (error) {
            console.error('Error details:', {
                status: error.response?.status,
                data: error.response?.data,
                headers: error.response?.headers
            });
            
            if (error.response?.status === 429 || i < retryCount - 1) { // Too Many Requests or not last try
                console.log('Error occurred, waiting before retry...');
                await delay(delayMs * 2); // Double the delay for errors
                continue;
            }
            throw error;
        }
    }
    throw new Error(`Failed after ${retryCount} retries`);
}

// Helper function to fetch player data from Sportradar
async function fetchPlayerData(tourId) {
    try {
        console.log(`Fetching ${tourId} player data...`);
        
        // Get the tour hierarchy first
        const toursUrl = `${SPORTRADAR_BASE_URL}/golf/trial/v3/en/tours/hierarchy.json?api_key=${SPORTRADAR_API_KEY}`;
        const { data: toursData } = await axios.get(toursUrl);
        
        // Get player profiles for the specific tour
        const tourProfilesUrl = `${SPORTRADAR_BASE_URL}/golf/trial/${TOUR_IDS[tourId]}/v3/en/players/profiles.json?api_key=${SPORTRADAR_API_KEY}`;
        const { data: tourData } = await axios.get(tourProfilesUrl);
        
        if (!tourData.players) {
            console.warn(`No players found for ${tourId}`);
            return {
                players: [],
                statistics: [],
                rankings: []
            };
        }

        // Get detailed info for each player
        const detailedPlayers = [];
        for (const player of tourData.players) {
            try {
                const playerUrl = `${SPORTRADAR_BASE_URL}/golf/trial/v3/en/players/${player.id}/profile.json?api_key=${SPORTRADAR_API_KEY}`;
                const { data: playerProfile } = await axios.get(playerUrl);
                
                if (playerProfile) {
                    detailedPlayers.push({
                        ...playerProfile,
                        tour: tourId
                    });
                }
                
                // Add delay between player requests
                await delay(1000);
            } catch (error) {
                console.error(`Error fetching profile for player ${player.id}:`, error.message);
                // Continue with next player
            }
        }

        return {
            players: detailedPlayers,
            statistics: tourData.statistics || [],
            rankings: tourData.rankings || []
        };
    } catch (error) {
        console.error(`Error fetching ${tourId} data:`, error.message);
        if (error.response) {
            console.error('Full error response:', JSON.stringify(error.response.data, null, 2));
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        }
        return {
            players: [],
            statistics: [],
            rankings: []
        };
    }
}

// Function to update player data in the database
async function updatePlayers() {
    console.log('Starting player update...');
    const client = await pool.connect();
    
    try {
        // Fetch data from all available tours
        const tours = ['pga', 'dpworld', 'lpga', 'champions', 'kornferry', 'liv'];
        const allPlayersData = [];

        for (const tour of tours) {
            console.log(`Fetching ${tour.toUpperCase()} Tour data...`);
            const tourData = await fetchPlayerData(tour);
            if (tourData.players.length > 0) {
                allPlayersData.push(...tourData.players);
            }
            // Add delay between tour requests
            await delay(2000);
        }

        if (allPlayersData.length === 0) {
            console.warn('No player data retrieved from any tour');
            return;
        }

        console.log(`Retrieved ${allPlayersData.length} total players, starting database update...`);
        await client.query('BEGIN');

        // Update players table
        let updatedPlayers = 0;
        for (const player of allPlayersData) {
            try {
                // Search for alternate name spellings
                const searchResponse = await makeApiCall(
                    `/players/${player.id}/profile.json?api_key=${SPORTRADAR_API_KEY}`
                );
                
                const alternateNames = searchResponse.data?.alternate_names || [];
                const aliases = [player.alias, ...alternateNames].filter(Boolean);

                await client.query(
                    `INSERT INTO players (
                        id, first_name, last_name, country, height, weight,
                        birth_place, residence, college, tour, alias,
                        abbr_name, handedness, turned_pro, member,
                        birthday, updated, alternate_names
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
                        updated = EXCLUDED.updated,
                        alternate_names = EXCLUDED.alternate_names`,
                    [
                        player.id,
                        player.first_name,
                        player.last_name,
                        player.country,
                        player.height,
                        player.weight,
                        player.birth_place,
                        player.residence,
                        player.college,
                        player.tour,
                        player.alias,
                        player.abbr_name,
                        player.handedness,
                        player.turned_pro,
                        player.member,
                        player.birthday,
                        player.updated,
                        aliases
                    ]
                );
                updatedPlayers++;
                console.log(`Updated player ${player.first_name} ${player.last_name} (${player.tour.toUpperCase()})`);
            } catch (error) {
                console.error(`Error updating player ${player.id}:`, error.message);
                // Continue with next player instead of failing the entire batch
                continue;
            }
        }

        await client.query('COMMIT');
        console.log(`Successfully updated ${updatedPlayers} players`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error during player update:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Schedule tasks
function scheduleTasks() {
    // Run player updates every Monday at 10 AM UTC+7 (3 AM UTC)
    cron.schedule('0 3 * * 1', async () => {
        try {
            console.log('Starting scheduled player update at:', new Date().toISOString());
            await updatePlayers();
            console.log('Completed scheduled player update at:', new Date().toISOString());
        } catch (error) {
            console.error('Scheduled player update failed:', error);
        }
    }, {
        timezone: "Asia/Bangkok"
    });

    console.log('Cron jobs scheduled - Player updates will run every Monday at 10 AM UTC+7');
}

module.exports = {
    scheduleTasks,
    updatePlayers
};
