const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const multer = require('multer');
const { uploadImage, updateImage, deleteImage } = require('../utils/cloudinary');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Configure multer for handling file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload an image.'), false);
        }
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
                ps.tournament_wins,
                ps.top_10_finishes,
                ps.career_high_ranking,
                ps.weeks_at_career_high,
                EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.birthday)) as age
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
            tour: player.tour,
            birthday: player.birthday,
            age: player.age,
            alias: player.alias,
            abbr_name: player.abbr_name,
            handedness: player.handedness,
            turned_pro: player.turned_pro,
            member: player.member,
            instagram_handle: player.instagram_handle,
            official_website: player.official_website,
            equipment_sponsor: player.equipment_sponsor,
            year_end_ranking: player.year_end_ranking || null,
            scoring_average: player.scoring_average || null,
            tournament_wins: player.tournament_wins || 0,
            top_10_finishes: player.top_10_finishes || null,
            career_high_ranking: player.career_high_ranking || null,
            weeks_at_career_high: player.weeks_at_career_high || null,
            updated: player.updated,
            image_url: player.image_url || null
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

// Upload or update player image
router.post('/:id/image', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Create a Buffer from the file
        const buffer = req.file.buffer;
        const base64Image = `data:${req.file.mimetype};base64,${buffer.toString('base64')}`;

        // Generate a public ID for Cloudinary based on player ID
        const publicId = `players/${id}`;

        // Upload to Cloudinary
        const imageUrl = await uploadImage(base64Image, publicId);

        // Update player record with new image URL
        await pool.query(
            'UPDATE players SET image_url = $1 WHERE id = $2',
            [imageUrl, id]
        );

        res.json({ imageUrl });
    } catch (err) {
        console.error('Error uploading player image:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete player image
router.delete('/:id/image', async (req, res) => {
    try {
        const { id } = req.params;

        // Get current image URL
        const result = await pool.query(
            'SELECT image_url FROM players WHERE id = $1',
            [id]
        );

        if (result.rows[0]?.image_url) {
            // Delete from Cloudinary
            await deleteImage(`players/${id}`);

            // Update player record
            await pool.query(
                'UPDATE players SET image_url = NULL WHERE id = $1',
                [id]
            );
        }

        res.json({ message: 'Image deleted successfully' });
    } catch (err) {
        console.error('Error deleting player image:', err);
        res.status(500).json({ error: err.message });
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
                EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.birthday)) as age,
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
        
        // Transform the data to handle null relationships and include new fields
        const transformedPlayer = {
            ...player,
            achievements: player.achievements?.[0] ? player.achievements : [],
            recent_results: player.recent_results?.[0] ? player.recent_results : [],
            tour: player.tour || 'N/A',
            alias: player.alias,
            abbr_name: player.abbr_name,
            handedness: player.handedness,
            turned_pro: player.turned_pro,
            member: player.member,
            birthday: player.birthday,
            age: player.age,
            updated: player.updated,
            image_url: player.image_url || null
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
