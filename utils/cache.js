const pool = require('../config/db');

class EventsCache {
    constructor() {
        this.cache = new Map();
        this.lastUpdated = null;
    }

    getCacheKey(filters) {
        // Create a unique key based on the filters
        return JSON.stringify({
            tour: filters.tour || null,
            country: filters.country || null,
            start_date: filters.start_date || null,
            end_date: filters.end_date || null,
            owgr: filters.owgr || null,
            limit: filters.limit || 10,
            page: filters.page || 1
        });
    }

    isCacheValid() {
        if (!this.lastUpdated) return false;

        const now = new Date();
        const cacheDate = new Date(this.lastUpdated);
        
        // Check if the cache is from a different day
        return now.toDateString() === cacheDate.toDateString();
    }

    async getEvents(filters) {
        const cacheKey = this.getCacheKey(filters);

        // If we have cached data for today, return it
        if (this.isCacheValid() && this.cache.has(cacheKey)) {
            console.log('✅ Returning cached events data');
            return this.cache.get(cacheKey);
        }

        // If cache is invalid or data not found, query the database
        console.log('🔄 Fetching fresh events data from database');
        
        let baseQuery = 'SELECT * FROM events WHERE 1=1 AND end_date >= CURRENT_DATE';
        let countQuery = 'SELECT COUNT(*) FROM events WHERE 1=1 AND end_date >= CURRENT_DATE';
        let values = [];
        let counter = 1;

        if (filters.tour) {
            baseQuery += ` AND tour = $${counter}`;
            countQuery += ` AND tour = $${counter}`;
            values.push(filters.tour);
            counter++;
        }

        if (filters.country) {
            baseQuery += ` AND country = $${counter}`;
            countQuery += ` AND country = $${counter}`;
            values.push(filters.country);
            counter++;
        }

        if (filters.start_date) {
            baseQuery += ` AND start_date >= $${counter}`;
            countQuery += ` AND start_date >= $${counter}`;
            values.push(filters.start_date);
            counter++;
        }

        if (filters.end_date) {
            baseQuery += ` AND end_date <= $${counter}`;
            countQuery += ` AND end_date <= $${counter}`;
            values.push(filters.end_date);
            counter++;
        }

        if (filters.owgr) {
            baseQuery += ` AND owgr = $${counter}`;
            countQuery += ` AND owgr = $${counter}`;
            values.push(filters.owgr === 'true');
            counter++;
        }

        baseQuery += ' ORDER BY start_date ASC';

        const totalResult = await pool.query(countQuery, values);
        const total = parseInt(totalResult.rows[0].count);
        const limit = parseInt(filters.limit) || 10;
        const page = parseInt(filters.page) || 1;
        const offset = (page - 1) * limit;

        baseQuery += ` LIMIT $${counter} OFFSET $${counter + 1}`;
        values.push(limit, offset);

        const result = await pool.query(baseQuery, values);
        const totalPages = Math.ceil(total / limit);

        const data = {
            page,
            limit,
            total,
            totalPages,
            events: result.rows
        };

        // Update cache
        this.cache.set(cacheKey, data);
        this.lastUpdated = new Date();

        return data;
    }

    clearCache() {
        this.cache.clear();
        this.lastUpdated = null;
        console.log('🧹 Cache cleared');
    }
}

// Create a singleton instance
const eventsCache = new EventsCache();

module.exports = eventsCache;
