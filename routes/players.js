const express = require('express');
const router = express.Router();
const { updatePlayers } = require('../utils/cron');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Get all players
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                p.*,
                ps.scoring_average,
                ps.top_10_finishes,
                ps.tournament_wins,
                ps.career_earnings,
                ps.career_wins,
                ps.career_high_ranking,
                ps.weeks_at_career_high,
                ps.year_end_ranking,
                json_agg(DISTINCT tr.*) FILTER (WHERE tr.tournament_date >= NOW() - INTERVAL '12 months') as recent_results,
                json_agg(DISTINCT pa.*) as achievements
            FROM players p
            LEFT JOIN player_statistics ps ON p.id = ps.player_id
            LEFT JOIN tournament_results tr ON p.id = tr.player_id
            LEFT JOIN player_achievements pa ON p.id = pa.player_id
            GROUP BY p.id, ps.id
            ORDER BY p.last_name, p.first_name
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching players:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a single player by ID with all their details
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(`
            SELECT 
                p.*,
                ps.scoring_average,
                ps.top_10_finishes,
                ps.tournament_wins,
                ps.career_earnings,
                ps.career_wins,
                ps.career_high_ranking,
                ps.weeks_at_career_high,
                ps.year_end_ranking,
                json_agg(DISTINCT tr.*) FILTER (WHERE tr.tournament_date >= NOW() - INTERVAL '12 months') as recent_results,
                json_agg(DISTINCT pa.*) as achievements
            FROM players p
            LEFT JOIN player_statistics ps ON p.id = ps.player_id
            LEFT JOIN tournament_results tr ON p.id = tr.player_id
            LEFT JOIN player_achievements pa ON p.id = pa.player_id
            WHERE p.id = $1
            GROUP BY p.id, ps.id
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching player:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Manually trigger player updates (protected endpoint)
router.post('/update', async (req, res) => {
    // TODO: Add authentication middleware
    try {
        await updatePlayers();
        res.json({ message: 'Player update completed successfully' });
    } catch (error) {
        console.error('Manual player update failed:', error);
        res.status(500).json({ error: 'Failed to update players' });
    }
});

module.exports = router;
