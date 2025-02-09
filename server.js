require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Import and use routes
const eventsRoutes = require('./routes/events');
app.use('/events', eventsRoutes);

// Test Route
app.get('/', (req, res) => {
    res.send('Asia Pro Golf Backend is running!');
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
