const cron = require('node-cron');
const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY;
const SPORTRADAR_BASE_URL = 'https://api.sportradar.us/golf/trial/v3/en';

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
async function makeApiCall(url, params, retryCount = 3, delayMs = 1000) {
    for (let i = 0; i < retryCount; i++) {
        try {
            // Add delay before each API call to respect rate limits
            await delay(delayMs);
            return await axios.get(url, { params });
        } catch (error) {
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
    const baseUrl = SPORTRADAR_BASE_URL;
    const currentYear = new Date().getFullYear();
    const year = currentYear - 1; // Use previous year to ensure data availability
    
    try {
        console.log(`Fetching ${tourId} tour data for year ${year}...`);
        
        // Try to fetch schedule for both current and previous year
        let scheduleResponse;
        try {
            scheduleResponse = await makeApiCall(
                `${baseUrl}/seasons/${year}/tours/${TOUR_IDS[tourId]}/schedule.json`,
                { api_key: SPORTRADAR_API_KEY }
            );
        } catch (error) {
            if (error.response?.status === 404) {
                console.log(`No schedule found for ${year}, trying ${year - 1}...`);
                scheduleResponse = await makeApiCall(
                    `${baseUrl}/seasons/${year - 1}/tours/${TOUR_IDS[tourId]}/schedule.json`,
                    { api_key: SPORTRADAR_API_KEY }
                );
            } else {
                throw error;
            }
        }
        console.log(`Successfully fetched ${tourId} schedule`);
        
        if (!scheduleResponse.data.tournaments || scheduleResponse.data.tournaments.length === 0) {
            console.log(`No tournaments found for ${tourId}`);
            return { players: [], statistics: [], rankings: [] };
        }
        
        // Fetch players list
        const playersResponse = await makeApiCall(
            `${baseUrl}/tours/${TOUR_IDS[tourId]}/players/profiles.json`,
            { api_key: SPORTRADAR_API_KEY }
        );
        console.log(`Successfully fetched ${tourId} players data`);
        
        // Fetch player statistics
        const statsResponse = await makeApiCall(
            `${baseUrl}/seasons/${year}/tours/${TOUR_IDS[tourId]}/statistics/players.json`,
            { api_key: SPORTRADAR_API_KEY }
        );
        console.log(`Successfully fetched ${tourId} statistics data`);
        
        // Fetch world golf rankings (shared across all tours)
        const rankingsResponse = await makeApiCall(
            `${baseUrl}/players/rankings.json`,
            { api_key: SPORTRADAR_API_KEY }
        );
        console.log(`Successfully fetched world rankings data`);

        return {
            players: playersResponse.data.players || [],
            statistics: statsResponse.data.players || [],
            rankings: rankingsResponse.data.rankings || []
        };
    } catch (error) {
        console.error(`Error fetching ${tourId} data:`, error.response?.data || error.message);
        // Return empty data instead of throwing to allow partial updates
        return {
            players: [],
            statistics: [],
            rankings: []
        };
    }
}

// Function to update player data in the database
async function updatePlayers() {
    console.log('Starting weekly player update...');
    const client = await pool.connect();
    
    try {
        // Fetch data for main tours sequentially to avoid rate limits
        console.log('Fetching PGA Tour data...');
        const pgaData = await fetchPlayerData('pga');
        
        console.log('Fetching DP World Tour data...');
        const dpworldData = await fetchPlayerData('dpworld');
        
        console.log('Fetching LPGA Tour data...');
        const lpgaData = await fetchPlayerData('lpga');

        // Combine player data from all tours
        const allPlayers = [
            ...pgaData.players,
            ...dpworldData.players,
            ...lpgaData.players
        ];
        const allStats = [
            ...pgaData.statistics,
            ...dpworldData.statistics,
            ...lpgaData.statistics
        ];
        const rankings = [
            ...pgaData.rankings,
            ...dpworldData.rankings,
            ...lpgaData.rankings
        ];

        if (allPlayers.length === 0) {
            console.warn('No player data retrieved from any tour');
            return;
        }

        console.log(`Retrieved ${allPlayers.length} players, starting database update...`);
        await client.query('BEGIN');

        // Update players table
        let updatedPlayers = 0;
        for (const player of allPlayers) {
            const stats = allStats.find(s => s.player_id === player.id);
            const ranking = rankings.find(r => r.player_id === player.id);
            
            try {
                await client.query(
                    `INSERT INTO players (
                        id, first_name, last_name, country, height, weight, 
                        birth_date, birth_place, residence, college, tour
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (id) DO UPDATE SET
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name,
                        country = EXCLUDED.country,
                        height = EXCLUDED.height,
                        weight = EXCLUDED.weight,
                        birth_date = EXCLUDED.birth_date,
                        birth_place = EXCLUDED.birth_place,
                        residence = EXCLUDED.residence,
                        college = EXCLUDED.college,
                        tour = EXCLUDED.tour,
                        updated_at = CURRENT_TIMESTAMP`,
                    [
                        player.id,
                        player.first_name,
                        player.last_name,
                        player.country,
                        player.height,
                        player.weight,
                        player.birth_date,
                        player.birth_place,
                        player.residence,
                        player.college,
                        player.tour
                    ]
                );

                // Update player statistics
                if (stats) {
                    await client.query(
                        `INSERT INTO player_statistics (
                            player_id, scoring_average, top_10_finishes,
                            tournament_wins, career_high_ranking,
                            weeks_at_career_high, year_end_ranking,
                            updated_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                        ON CONFLICT (player_id) DO UPDATE SET
                            scoring_average = EXCLUDED.scoring_average,
                            top_10_finishes = EXCLUDED.top_10_finishes,
                            tournament_wins = EXCLUDED.tournament_wins,
                            career_high_ranking = EXCLUDED.career_high_ranking,
                            weeks_at_career_high = EXCLUDED.weeks_at_career_high,
                            year_end_ranking = EXCLUDED.year_end_ranking,
                            updated_at = CURRENT_TIMESTAMP`,
                        [
                            player.id,
                            stats.scoring_average,
                            stats.top_10_finishes,
                            stats.tournament_wins,
                            ranking?.career_high || null,
                            ranking?.weeks_at_career_high || null,
                            ranking?.current_rank || null
                        ]
                    );
                }
                updatedPlayers++;
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
        console.error('Error during weekly player update:', error);
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
