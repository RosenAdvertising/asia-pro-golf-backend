const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function createTriggerFunction() {
    try {
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);
        
        // Create triggers for each table
        const tables = ['players', 'player_statistics', 'player_achievements', 'tournament_results'];
        
        for (const table of tables) {
            await pool.query(`
                DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
                CREATE TRIGGER update_${table}_updated_at
                    BEFORE UPDATE ON ${table}
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
            `);
        }
        
        console.log('Triggers created successfully');
    } catch (error) {
        console.error('Failed to create triggers:', error);
    } finally {
        await pool.end();
    }
}

createTriggerFunction();
