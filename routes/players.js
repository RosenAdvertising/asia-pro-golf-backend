const express = require('express');
const router = express.Router();
const { updatePlayers } = require('../utils/cron');

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
