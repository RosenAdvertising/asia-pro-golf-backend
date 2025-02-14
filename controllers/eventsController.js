const pool = require('../config/db');
const eventsCache = require('../utils/cache');

const getAllEvents = async (req, res) => {
    try {
        const filters = {
            tour: req.query.tour,
            country: req.query.country,
            start_date: req.query.start_date,
            end_date: req.query.end_date,
            owgr: req.query.owgr,
            limit: req.query.limit,
            page: req.query.page
        };

        const result = await eventsCache.getEvents(filters);
        res.json(result);
    } catch (err) {
        console.error('❌ Error fetching events:', err.message);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getAllEvents };
