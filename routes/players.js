const express = require('express');
const router = express.Router();
const { updatePlayers } = require('../utils/cron');
const pool = require('../config/db');

// Get all players
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id,
                first_name,
                last_name,
                country,
                birth_date,
                height,
                handedness,
                college,
                turned_pro,
                profile_image_url
            FROM players
            ORDER BY last_name, first_name
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching players:', error);
        res.status(500).json({ error: 'Failed to fetch players' });
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
