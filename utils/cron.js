const cron = require('node-cron');
const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY;
const SPORTRADAR_BASE_URL = 'https://api.sportradar.com';

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
async function makeApiCall(path, retryCount = 3, delayMs = 1000) {
    const options = {
        method: 'GET',
        headers: {
            'accept': 'application/json'
        }
    };

    const url = `${SPORTRADAR_BASE_URL}${path}?api_key=${SPORTRADAR_API_KEY}`;
    console.log('Making request to:', url);
    
    for (let i = 0; i < retryCount; i++) {
        try {
            // Add delay before each API call to respect rate limits
            await delay(delayMs);
            const response = await axios.get(url, options);
            return response;
        } catch (error) {
            console.error('Error details:', {
                status: error.response?.status,
                data: error.response?.data,
                headers: error.response?.headers
            });
            
            if (error.response?.status === 429) { // Too Many Requests
                console.log('Rate limit hit, waiting before retry...');
                await delay(delayMs * 2); // Double the delay for rate limit errors
                continue;
            }
            throw error;
        }
    }
    throw new Error(`Failed after ${retryCount} retries`);
}

// Helper function to fetch player data from Sportradar
async function fetchPlayerData(tourId) {
    const currentYear = new Date().getFullYear();
    
    try {
        console.log(`Fetching ${tourId} player data...`);
        
        // Get player profiles which includes basic info and statistics
        const playersResponse = await makeApiCall(
            `/golf/trial/${TOUR_IDS[tourId]}/v3/en/${currentYear}/players/profiles.json`
        );
        
        // Log the full response for debugging
        console.log('Response:', JSON.stringify(playersResponse.data, null, 2));
        console.log(`Successfully fetched ${tourId} player data`);

        return {
            players: playersResponse.data.players || [],
            statistics: playersResponse.data.players || [],
            rankings: playersResponse.data.players || []
        };
    } catch (error) {
        console.error(`Error fetching ${tourId} data:`, error.response?.data || error.message);
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
        // Only fetch PGA Tour data for now
        console.log('Fetching PGA Tour data...');
        const pgaData = await fetchPlayerData('pga');

        if (pgaData.players.length === 0) {
            console.warn('No player data retrieved');
            return;
        }

        console.log(`Retrieved ${pgaData.players.length} players, starting database update...`);
        await client.query('BEGIN');

        // Update players table
        let updatedPlayers = 0;
        for (const player of pgaData.players) {
            try {
                await client.query(
                    `INSERT INTO players (
                        id, first_name, last_name, country, height, weight,
                        birth_place, residence, college, tour, alias,
                        abbr_name, handedness, turned_pro, member,
                        birthday, updated
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
                        updated = EXCLUDED.updated`,
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
                        'pga', // hardcoded for now since we're only fetching PGA
                        player.alias,
                        player.abbr_name,
                        player.handedness,
                        player.turned_pro,
                        player.member,
                        player.birthday,
                        player.updated
                    ]
                );
                updatedPlayers++;
                console.log(`Updated player ${player.first_name} ${player.last_name}`);
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
