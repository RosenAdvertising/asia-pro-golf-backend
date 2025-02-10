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
    
    // Fetch basic player profiles
    const profileResponse = await axios.get(`${baseUrl}/tours/${tourId}/players/profiles.json`, {
        params: { api_key: SPORTRADAR_API_KEY }
    });
    
    // Fetch player statistics
    const statsResponse = await axios.get(`${baseUrl}/tours/${tourId}/statistics.json`, {
        params: { api_key: SPORTRADAR_API_KEY }
    });
    
    // Fetch tournament results for the last 12 months
    const today = new Date();
    const lastYear = new Date(today.setFullYear(today.getFullYear() - 1));
    const resultsResponse = await axios.get(`${baseUrl}/tours/${tourId}/tournaments/schedule.json`, {
        params: { 
            api_key: SPORTRADAR_API_KEY,
            year: lastYear.getFullYear()
        }
    });

    return {
        players: profileResponse.data.players,
        statistics: statsResponse.data.statistics,
        tournaments: resultsResponse.data.tournaments
    };
}

// Temporary function to inspect player data structure
async function inspectPlayerData() {
    try {
        const { players } = await fetchPlayerData('pga'); // Get PGA tour players
        if (players && players[0]) {
            console.log('Example player data structure:');
            console.log(JSON.stringify(players[0], null, 2));
        }
    } catch (error) {
        console.error('Error fetching player data:', error);
    }
}

// Update player data and rankings
async function updatePlayers() {
    const client = await pool.connect();
    try {
        console.log('Starting weekly player update...');

        await client.query('BEGIN');

        // Get data for each tour
        const tours = ['pga', 'euro', 'apgc']; // Add other tours as needed
        for (const tourId of tours) {
            const { players, statistics, tournaments } = await fetchPlayerData(tourId);

            for (const player of players) {
                // Insert or update player basic info
                const playerResult = await client.query(`
                    INSERT INTO players (
                        first_name, last_name, country, birth_date, height, 
                        handedness, college, turned_pro, profile_image_url,
                        nationality, languages_spoken, instagram_handle,
                        official_website, equipment_sponsor
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    ON CONFLICT (first_name, last_name) DO UPDATE SET
                        country = EXCLUDED.country,
                        birth_date = EXCLUDED.birth_date,
                        height = EXCLUDED.height,
                        handedness = EXCLUDED.handedness,
                        college = EXCLUDED.college,
                        turned_pro = EXCLUDED.turned_pro,
                        profile_image_url = EXCLUDED.profile_image_url,
                        nationality = EXCLUDED.nationality,
                        languages_spoken = EXCLUDED.languages_spoken,
                        instagram_handle = EXCLUDED.instagram_handle,
                        official_website = EXCLUDED.official_website,
                        equipment_sponsor = EXCLUDED.equipment_sponsor
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
                    player.profile_image_url,
                    player.nationality || player.country, // fallback to country if nationality not provided
                    player.languages_spoken || [], // default empty array
                    player.instagram_handle,
                    player.official_website,
                    player.equipment_sponsor
                ]);

                const playerId = playerResult.rows[0].id;

                // Update player statistics
                const playerStats = statistics?.players?.find(s => 
                    s.first_name === player.first_name && s.last_name === player.last_name
                );

                if (playerStats) {
                    await client.query(`
                        INSERT INTO player_statistics (
                            player_id, scoring_average, top_10_finishes,
                            tournament_wins, career_earnings, career_wins,
                            career_high_ranking, weeks_at_career_high,
                            year_end_ranking
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        ON CONFLICT (player_id) DO UPDATE SET
                            scoring_average = EXCLUDED.scoring_average,
                            top_10_finishes = EXCLUDED.top_10_finishes,
                            tournament_wins = EXCLUDED.tournament_wins,
                            career_earnings = EXCLUDED.career_earnings,
                            career_wins = EXCLUDED.career_wins,
                            career_high_ranking = EXCLUDED.career_high_ranking,
                            weeks_at_career_high = EXCLUDED.weeks_at_career_high,
                            year_end_ranking = EXCLUDED.year_end_ranking,
                            updated_at = CURRENT_TIMESTAMP
                    `, [
                        playerId,
                        playerStats.scoring_avg,
                        playerStats.top_10,
                        playerStats.first_place,
                        playerStats.earnings,
                        playerStats.career_wins,
                        playerStats.career_high_rank,
                        playerStats.weeks_at_career_high,
                        playerStats.year_end_rank
                    ]);
                }

                // Update tournament results
                for (const tournament of tournaments || []) {
                    const playerResult = tournament.leaderboard?.players?.find(p => 
                        p.first_name === player.first_name && p.last_name === player.last_name
                    );

                    if (playerResult) {
                        await client.query(`
                            INSERT INTO tournament_results (
                                player_id, tournament_name, tournament_date,
                                finish_position, score, earnings, is_major
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                            ON CONFLICT (player_id, tournament_name, tournament_date) DO UPDATE SET
                                finish_position = EXCLUDED.finish_position,
                                score = EXCLUDED.score,
                                earnings = EXCLUDED.earnings,
                                is_major = EXCLUDED.is_major
                        `, [
                            playerId,
                            tournament.name,
                            tournament.start_date,
                            playerResult.position,
                            playerResult.score,
                            playerResult.money,
                            tournament.is_major || false
                        ]);
                    }
                }
            }
        }

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
    updatePlayers, // Export for manual running if needed
    inspectPlayerData // Export for manual inspection if needed
};
