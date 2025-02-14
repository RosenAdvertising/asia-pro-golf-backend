const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: 'postgresql://cal_events_live_user:5VGzGSK3K2f5A8FczZlVsjLh8zNEua2A@dpg-cufl91dds78s73fm7jqg-a.singapore-postgres.render.com/cal_events_live',
    ssl: {
        rejectUnauthorized: false
    }
});

async function runMigration() {
    const client = await pool.connect();
    try {
        const migrationPath = path.join(__dirname, '..', 'migrations', '20250214_update_players_primary_key.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        
        console.log('Migration completed successfully');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error running migration:', err);
    } finally {
        client.release();
        pool.end();
    }
}

runMigration();
