require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY;
const SPORTRADAR_BASE_URL = 'http://api.sportradar.us/golf/trial/v3/en';
const MAX_RETRIES = 3;
const RATE_LIMIT_DELAY = 5000; // 5 seconds between requests

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryableRequest(url, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url);
            return response;
        } catch (error) {
            if (error.response?.status === 429) {
                console.log(`Rate limited, waiting ${RATE_LIMIT_DELAY/1000} seconds before retry...`);
                await sleep(RATE_LIMIT_DELAY);
                continue;
            }
            throw error;
        }
    }
}

async function updatePlayerRankings() {
    try {
        console.log('Starting player rankings update...');

        // Get all players from our database
        const { rows: players } = await pool.query('SELECT id, first_name, last_name FROM players');

        for (const player of players) {
            try {
                // Search for player in Sportsradar API
                const searchUrl = `${SPORTRADAR_BASE_URL}/players/search/${encodeURIComponent(player.first_name + ' ' + player.last_name)}.json?api_key=${SPORTRADAR_API_KEY}`;
                const { data: searchResult } = await retryableRequest(searchUrl);

                if (searchResult.players && searchResult.players.length > 0) {
                    const playerData = searchResult.players[0];
                    
                    // Get player's statistics and rankings
                    const statsUrl = `${SPORTRADAR_BASE_URL}/players/${playerData.id}/statistics.json?api_key=${SPORTRADAR_API_KEY}`;
                    const { data: playerStats } = await retryableRequest(statsUrl);

                    // Get career statistics
                    const careerUrl = `${SPORTRADAR_BASE_URL}/players/${playerData.id}/career.json?api_key=${SPORTRADAR_API_KEY}`;
                    const { data: careerStats } = await retryableRequest(careerUrl);

                    // Extract ranking information
                    const rankings = playerStats.rankings || {};
                    const career = careerStats.statistics || {};

                    // Upsert player statistics
                    await pool.query(`
                        INSERT INTO player_statistics (
                            player_id,
                            scoring_average,
                            top_10_finishes,
                            tournament_wins,
                            career_high_ranking,
                            weeks_at_career_high,
                            year_end_ranking,
                            updated_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                        ON CONFLICT (player_id)
                        DO UPDATE SET
                            scoring_average = EXCLUDED.scoring_average,
                            top_10_finishes = EXCLUDED.top_10_finishes,
                            tournament_wins = EXCLUDED.tournament_wins,
                            career_high_ranking = EXCLUDED.career_high_ranking,
                            weeks_at_career_high = EXCLUDED.weeks_at_career_high,
                            year_end_ranking = EXCLUDED.year_end_ranking,
                            updated_at = CURRENT_TIMESTAMP
                    `, [
                        player.id,
                        career.scoring_average || null,
                        career.top_10_finishes || null,
                        career.tournament_wins || 0,
                        rankings.career_high || null,
                        rankings.weeks_at_career_high || null,
                        rankings.current || null
                    ]);

                    console.log(`Updated rankings for player: ${player.first_name} ${player.last_name}`);
                    console.log(`Current Rank: ${rankings.current || 'Not ranked'}`);
                    console.log(`Career High: ${rankings.career_high || 'N/A'}`);
                    console.log('---');
                } else {
                    console.log(`No data found for player: ${player.first_name} ${player.last_name}`);
                }
            } catch (error) {
                console.error(`Error updating rankings for ${player.first_name} ${player.last_name}:`, error.message);
                continue; // Continue with next player even if one fails
            }

            // Add a delay between players to respect API rate limits
            await sleep(RATE_LIMIT_DELAY);
        }

        console.log('Player rankings update completed');
    } catch (error) {
        console.error('Error in updatePlayerRankings:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run the update if called directly
if (require.main === module) {
    updatePlayerRankings()
        .then(() => console.log('Rankings update completed successfully'))
        .catch(error => {
            console.error('Rankings update failed:', error);
            process.exit(1);
        });
}

module.exports = { updatePlayerRankings };
