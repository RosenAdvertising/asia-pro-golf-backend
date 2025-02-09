const express = require('express');
const router = express.Router();
const { getAllEvents } = require('../controllers/eventsController');

// Route to get all events
router.get('/', getAllEvents);

module.exports = router;
