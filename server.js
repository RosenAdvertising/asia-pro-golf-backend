require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { scheduleTasks } = require('./utils/cron');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Import and use routes
const eventsRoutes = require('./routes/events');
const playersRoutes = require('./routes/players');

app.use('/events', eventsRoutes);
app.use('/players', playersRoutes);

// Test Route
app.get('/', (req, res) => {
    res.send('Asia Pro Golf Backend is running!');
});

// Initialize cron jobs
scheduleTasks();

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('Cron jobs initialized - Player updates scheduled for every Monday at 1 AM');
});
