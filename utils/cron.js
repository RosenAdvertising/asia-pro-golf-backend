const cron = require('node-cron');
const { Pool } = require('pg');
const axios = require('axios');
const { SPORTRADAR_API_KEY } = process.env;

// Initialize database pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Helper function to fetch player data from Sportradar
async function fetchPlayerData(tourId) {
    const baseUrl = 'http://api.sportradar.us/golf/trial/v3/en';
    const response = await axios.get(`${baseUrl}/tours/${tourId}/players/profiles.json`, {
        params: { api_key: SPORTRADAR_API_KEY }
    });
    return response.data.players;
}

// Update player data and rankings
async function updatePlayers() {
    const client = await pool.connect();
    try {
        console.log('Starting weekly player update...');

        // List of tours to fetch players from
        const tours = [
            { id: 'pga', name: 'PGA Tour' },
            { id: 'lpga', name: 'LPGA' },
            { id: 'euro', name: 'European Tour' },
            // Add other tours as needed
        ];

        // Start a transaction
        await client.query('BEGIN');

        for (const tour of tours) {
            console.log(`Fetching players from ${tour.name}...`);
            const players = await fetchPlayerData(tour.id);

            for (const player of players) {
                // Update or insert player
                await client.query(`
                    INSERT INTO players (
                        first_name, last_name, country, birth_date, height, 
                        handedness, college, turned_pro, profile_image_url
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (first_name, last_name) DO UPDATE SET
                        country = EXCLUDED.country,
                        birth_date = EXCLUDED.birth_date,
                        height = EXCLUDED.height,
                        handedness = EXCLUDED.handedness,
                        college = EXCLUDED.college,
                        turned_pro = EXCLUDED.turned_pro,
                        profile_image_url = EXCLUDED.profile_image_url
                    RETURNING id
                `, [
                    player.first_name,
                    player.last_name,
                    player.country,
                    player.birth_date,
                    player.height,
                    player.handedness,
                    player.college,
                    player.turned_pro,
                    player.profile_image_url
                ]);

                // Update player tour association
                await client.query(`
                    INSERT INTO player_tours (player_id, tour_id, active)
                    VALUES (
                        (SELECT id FROM players WHERE first_name = $1 AND last_name = $2),
                        $3,
                        true
                    )
                    ON CONFLICT (player_id, tour_id) DO UPDATE SET
                        active = true
                `, [player.first_name, player.last_name, tour.id]);
            }
        }

        // Update rankings
        console.log('Updating player rankings...');
        const rankingTypes = ['owgr', 'race_to_cme_globe', 'rolex'];
        for (const type of rankingTypes) {
            await client.query(`
                INSERT INTO player_rankings (player_id, ranking_type, ranking, points, week_date)
                SELECT 
                    p.id,
                    $1,
                    p.current_ranking,
                    p.current_points,
                    CURRENT_DATE
                FROM players p
                WHERE p.current_ranking IS NOT NULL
                AND p.current_points IS NOT NULL
            `, [type]);
        }

        // Clean up old ranking data (keep last 2 years)
        await client.query(`
            DELETE FROM player_rankings
            WHERE week_date < CURRENT_DATE - INTERVAL '2 years'
        `);

        await client.query('COMMIT');
        console.log('Weekly player update completed successfully');
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
    // Run player updates every Monday at 1 AM
    cron.schedule('0 1 * * 1', async () => {
        try {
            await updatePlayers();
        } catch (error) {
            console.error('Scheduled player update failed:', error);
        }
    });

    console.log('Cron jobs scheduled');
}

module.exports = {
    scheduleTasks,
    updatePlayers // Export for manual running if needed
};
