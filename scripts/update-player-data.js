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

async function updatePlayerData() {
    try {
        console.log('Starting player data update...');

        // First, let's get all tours to check membership
        const toursUrl = `${SPORTRADAR_BASE_URL}/tours/hierarchy.json?api_key=${SPORTRADAR_API_KEY}`;
        const { data: toursData } = await axios.get(toursUrl);
        
        // Get all players from our database
        const { rows: players } = await pool.query('SELECT id, first_name, last_name FROM players');

        for (const player of players) {
            try {
                // Search for player in Sportsradar API
                const searchUrl = `${SPORTRADAR_BASE_URL}/players/search/${encodeURIComponent(player.first_name + ' ' + player.last_name)}.json?api_key=${SPORTRADAR_API_KEY}`;
                const { data: searchResult } = await axios.get(searchUrl);

                if (searchResult.players && searchResult.players.length > 0) {
                    const playerData = searchResult.players[0];
                    
                    // Get detailed player info including tour membership
                    const playerUrl = `${SPORTRADAR_BASE_URL}/players/${playerData.id}/profile.json?api_key=${SPORTRADAR_API_KEY}`;
                    const { data: playerProfile } = await axios.get(playerUrl);

                    // Get player's tour memberships
                    const memberships = playerProfile.tours?.map(tour => tour.name).join(', ') || null;

                    // Update player in database
                    await pool.query(`
                        UPDATE players
                        SET 
                            birth_date = $1,
                            tour = $2,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = $3
                    `, [
                        playerProfile.birth_date || null,
                        memberships,
                        player.id
                    ]);

                    console.log(`Updated data for player: ${player.first_name} ${player.last_name}`);
                    console.log(`Tour memberships: ${memberships || 'None found'}`);
                    console.log(`Birth date: ${playerProfile.birth_date || 'Not available'}`);
                    console.log('---');
                }
            } catch (error) {
                console.error(`Error updating player ${player.first_name} ${player.last_name}:`, error.message);
                continue; // Continue with next player even if one fails
            }

            // Add a small delay between requests to respect API rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('Player data update completed');
    } catch (error) {
        console.error('Error in updatePlayerData:', error);
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

module.exports = { updatePlayerData };
