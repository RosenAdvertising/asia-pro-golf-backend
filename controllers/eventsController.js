const pool = require('../config/db');

const getAllEvents = async (req, res) => {
    try {
        let query = 'SELECT * FROM events WHERE 1=1';
        let values = [];
        let counter = 1;

        // Filtering by tour
        if (req.query.tour) {
            query += ` AND tour = $${counter}`;
            values.push(req.query.tour);
            counter++;
        }

        // Filtering by country
        if (req.query.country) {
            query += ` AND country = $${counter}`;
            values.push(req.query.country);
            counter++;
        }

        // Filtering by start_date
        if (req.query.start_date) {
            query += ` AND start_date >= $${counter}`;
            values.push(req.query.start_date);
            counter++;
        }

        // Filtering by end_date
        if (req.query.end_date) {
            query += ` AND end_date <= $${counter}`;
            values.push(req.query.end_date);
            counter++;
        }

        query += ' ORDER BY start_date ASC';

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        query += ` LIMIT $${counter} OFFSET $${counter + 1}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);
        res.json({
            page,
            limit,
            total: result.rowCount,
            events: result.rows
        });
    } catch (err) {
        console.error('❌ Error fetching events:', err.message);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getAllEvents };
