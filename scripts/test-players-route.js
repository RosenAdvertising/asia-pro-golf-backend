require('dotenv').config();
const axios = require('axios');

async function testPlayersRoute() {
    try {
        console.log('Testing local players route...');
        const response = await axios.get('http://localhost:5000/players');
        console.log('Response:', {
            status: response.status,
            data: response.data
        });
    } catch (error) {
        console.error('Error testing route:', {
            message: error.message,
            response: error.response?.data
        });
    }
}

testPlayersRoute();
