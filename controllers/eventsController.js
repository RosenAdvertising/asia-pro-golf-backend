const pool = require('../config/db'); // Import PostgreSQL connection

// Function to get all events from the database
const getAllEvents = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM events ORDER BY start_date ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching events:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = { getAllEvents };
