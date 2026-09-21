import oracledb from 'oracledb';
import dotenv from 'dotenv';

// Load variables from .env
dotenv.config();

export async function initializeDatabase() {
    try {
        await oracledb.createPool({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: process.env.DB_CONNECT_STRING,
            // Pooling configuration
            poolMin: 2,
            poolMax: 10,
            poolIncrement: 2
        });
        console.log("✅ Oracle Database Connection Pool initialized.");
    } catch (err) {
        console.error("❌ Oracle Pool Creation failed: ", err.message);
        throw err;
    }
}

export async function closeDatabase() {
    try {
        await oracledb.getPool().close(10);
        console.log("Oracle Connection Pool closed.");
    } catch (err) {
        console.error("Error closing connection pool: ", err.message);
    }
}

// Helper function to easily run queries later
export async function executeQuery(sql, binds = [], options = { outFormat: oracledb.OUT_FORMAT_OBJECT }) {
    let connection;
    try {
        connection = await oracledb.getConnection();
        return await connection.execute(sql, binds, options);
    } catch (err) {
        console.error("Query Execution Error:", err);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close(); // Returns connection back to the pool
            } catch (err) {
                console.error("Error closing connection:", err);
            }
        }
    }
}