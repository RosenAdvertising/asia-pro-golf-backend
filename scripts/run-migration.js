const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function runMigration() {
    try {
        const sql = fs.readFileSync('./migrations/20250210_update_players.sql', 'utf8');
        
        // Split the SQL file into individual statements
        const statements = sql.split(';').filter(stmt => stmt.trim());
        
        // Execute each statement
        for (const statement of statements) {
            if (statement.trim()) {
                console.log('Executing:', statement.trim().slice(0, 100) + '...');
                await pool.query(statement);
            }
        }
        
        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
