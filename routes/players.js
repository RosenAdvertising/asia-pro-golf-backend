const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// GET all players with available info
router.get('/', async (req, res) => {
    try {
        // Query both basic info and extended info
        const result = await pool.query(`
            SELECT 
                p.*,
                ps.year_end_ranking,
                ps.scoring_average,
                ps.tournament_wins
            FROM players p
            LEFT JOIN player_statistics ps ON p.id = ps.player_id
            ORDER BY 
                COALESCE(ps.year_end_ranking, 999999),
                p.last_name,
                p.first_name
        `);

        // Transform the data to include only what we need
        const players = result.rows.map(player => ({
            id: player.id,
            first_name: player.first_name,
            last_name: player.last_name,
            country: player.country,
            nationality: player.nationality,
            profile_image_url: player.profile_image_url,
            tour: player.tour || 'N/A', // Use the tour field from players table
            year_end_ranking: player.year_end_ranking || null,
            scoring_average: player.scoring_average || null,
            tournament_wins: player.tournament_wins || 0
        }));

        res.json(players);
    } catch (error) {
        console.error('Error in /players route:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// GET a single player by ID with all their details
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(`
            SELECT 
                p.*,
                ps.*,
                json_agg(DISTINCT pa.*) FILTER (WHERE pa.id IS NOT NULL) as achievements,
                json_agg(DISTINCT tr.*) FILTER (WHERE tr.id IS NOT NULL AND tr.tournament_date >= NOW() - INTERVAL '12 months') as recent_results
            FROM players p
            LEFT JOIN player_statistics ps ON p.id = ps.player_id
            LEFT JOIN player_achievements pa ON p.id = pa.player_id
            LEFT JOIN tournament_results tr ON p.id = tr.player_id
            WHERE p.id = $1
            GROUP BY p.id, ps.id
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }

        const player = result.rows[0];
        
        // Transform the data to handle null relationships
        const transformedPlayer = {
            ...player,
            achievements: player.achievements?.[0] ? player.achievements : [],
            recent_results: player.recent_results?.[0] ? player.recent_results : [],
            tour: player.tour || 'N/A'
        };

        res.json(transformedPlayer);
    } catch (error) {
        console.error('Error fetching player:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router;
