require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function runMigration(migrationFile) {
    try {
        console.log('Running migration...');
        const migrationPath = path.isAbsolute(migrationFile) 
            ? migrationFile 
            : path.join(__dirname, '..', migrationFile);
            
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(migrationSQL);
        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// If called directly, use command line argument or default migration
if (require.main === module) {
    const migrationFile = process.argv[2] || 'migrations/20250212_add_gender_birthdate.sql';
    runMigration(migrationFile)
        .then(() => console.log('All done!'))
        .catch(error => {
            console.error('Error:', error);
            process.exit(1);
        });
}

module.exports = { runMigration };
