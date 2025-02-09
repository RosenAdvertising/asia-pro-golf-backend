const pool = require('../config/db');

const getAllEvents = async (req, res) => {
    try {
        let baseQuery = 'SELECT * FROM events WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) FROM events WHERE 1=1';
        let values = [];
        let counter = 1;

        // Filtering by tour
        if (req.query.tour) {
            baseQuery += ` AND tour = $${counter}`;
            countQuery += ` AND tour = $${counter}`;
            values.push(req.query.tour);
            counter++;
        }

        // Filtering by country
        if (req.query.country) {
            baseQuery += ` AND country = $${counter}`;
            countQuery += ` AND country = $${counter}`;
            values.push(req.query.country);
            counter++;
        }

        // Filtering by start_date
        if (req.query.start_date) {
            baseQuery += ` AND start_date >= $${counter}`;
            countQuery += ` AND start_date >= $${counter}`;
            values.push(req.query.start_date);
            counter++;
        }

        // Filtering by end_date
        if (req.query.end_date) {
            baseQuery += ` AND end_date <= $${counter}`;
            countQuery += ` AND end_date <= $${counter}`;
            values.push(req.query.end_date);
            counter++;
        }

        baseQuery += ' ORDER BY start_date ASC';

        // Get the total number of events before applying pagination
        const totalResult = await pool.query(countQuery, values);
        const total = parseInt(totalResult.rows[0].count);
        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;
        const offset = (page - 1) * limit;

        // Pagination
        baseQuery += ` LIMIT $${counter} OFFSET $${counter + 1}`;
        values.push(limit, offset);

        const result = await pool.query(baseQuery, values);
        const totalPages = Math.ceil(total / limit);

        res.json({
            page,
            limit,
            total, // Total number of events
            totalPages, // Total number of pages
            events: result.rows
        });
    } catch (err) {
        console.error('❌ Error fetching events:', err.message);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getAllEvents };
