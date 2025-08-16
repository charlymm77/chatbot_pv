import { MemoryDB } from "@builderbot/bot";
import mysql from "mysql2/promise";

class FixedMysqlAdapter extends MemoryDB {
    constructor(credentials) {
        super();
        this.listHistory = [];
        this.credentials = {
            host: null,
            user: null,
            database: null,
            password: null,
            port: 3306,
            // Connection pool configuration
            connectionLimit: 10,
            acquireTimeout: 60000,
            timeout: 60000,
            reconnect: true,
            multipleStatements: false,
            charset: "utf8mb4",
            timezone: "local",
            ssl: false,
            supportBigNumbers: true,
            bigNumberStrings: true,
            dateStrings: false,
            debug: false,
            trace: false,
            stringifyObjects: false,
            typeCast: true,
        };

        this.getPrevByNumber = async (from) => {
            let connection;
            try {
                connection = await this.pool.getConnection();
                const sql = `SELECT * FROM history WHERE phone=? ORDER BY id DESC LIMIT 1`;
                const [rows] = await connection.execute(sql, [from]);
                
                if (rows.length) {
                    const [row] = rows;
                    row.options = JSON.parse(row.options);
                    return row;
                }
                return {};
            } catch (error) {
                console.error('Error in getPrevByNumber:', error);
                throw error;
            } finally {
                if (connection) connection.release();
            }
        };

        this.save = async (ctx) => {
            let connection;
            try {
                connection = await this.pool.getConnection();
                const sql = 'INSERT INTO history (ref, keyword, answer, refSerialize, phone, options) VALUES (?, ?, ?, ?, ?, ?)';
                const values = [ctx.ref, ctx.keyword, ctx.answer, ctx.refSerialize, ctx.from, JSON.stringify(ctx.options)];
                await connection.execute(sql, values);
            } catch (error) {
                console.error('Error saving to database:', error);
                throw error;
            } finally {
                if (connection) connection.release();
            }
        };

        this.createTable = async () => {
            let connection;
            try {
                connection = await this.pool.getConnection();
                const tableName = 'history';
                const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (
                    id INT AUTO_INCREMENT PRIMARY KEY, 
                    ref varchar(255) DEFAULT NULL,
                    keyword varchar(255) NULL,
                    answer longtext NULL,
                    refSerialize varchar(255) NULL,
                    phone varchar(255) NOT NULL,
                    options longtext NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`;
                
                await connection.execute(sql);
                console.log(`Table ${tableName} created or verified successfully`);
                return true;
            } catch (error) {
                console.error('Error creating table:', error);
                throw error;
            } finally {
                if (connection) connection.release();
            }
        };

        this.checkTableExists = async () => {
            let connection;
            try {
                connection = await this.pool.getConnection();
                const sql = "SHOW TABLES LIKE 'history'";
                const [rows] = await connection.execute(sql);
                
                if (!rows.length) {
                    await this.createTable();
                    return false;
                }
                return true;
            } catch (error) {
                console.error('Error checking table existence:', error);
                throw error;
            } finally {
                if (connection) connection.release();
            }
        };

        // Test connection method
        this.testConnection = async () => {
            let connection;
            try {
                connection = await this.pool.getConnection();
                await connection.execute('SELECT 1');
                console.log('✅ Database connection test successful');
                return true;
            } catch (error) {
                console.error('❌ Database connection test failed:', error);
                throw error;
            } finally {
                if (connection) connection.release();
            }
        };

        // Filter out invalid connection options for mysql2
        const validCredentials = {
            host: credentials.host,
            port: credentials.port || 3306,
            user: credentials.user,
            password: credentials.password,
            database: credentials.database,
            connectionLimit: credentials.connectionLimit || 10,
            acquireTimeout: credentials.acquireTimeout || 60000,
            timeout: credentials.timeout || 60000,
            multipleStatements: credentials.multipleStatements || false,
            charset: credentials.charset || "utf8mb4",
            timezone: credentials.timezone || "local",
            ssl: credentials.ssl || false,
            supportBigNumbers: credentials.supportBigNumbers || true,
            bigNumberStrings: credentials.bigNumberStrings || true,
            dateStrings: credentials.dateStrings || false,
            debug: credentials.debug || false,
            trace: credentials.trace || false,
            stringifyObjects: credentials.stringifyObjects || false,
            typeCast: credentials.typeCast !== false,
        };

        this.credentials = validCredentials;
        this.init().then();
    }

    async init() {
        try {
            console.log('🔧 Initializing MySQL connection pool...');
            
            // Create connection pool instead of single connection
            this.pool = mysql.createPool(this.credentials);

            // Test the connection
            await this.testConnection();
            
            // Check/create table
            await this.checkTableExists();
            
            console.log('✅ Connected Provider');
        } catch (error) {
            console.error(`❌ Failed connection request:`, error);
            throw error;
        }
    }

    // Method to properly close the pool when shutting down
    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('✅ Database connection pool closed');
        }
    }
}

export { FixedMysqlAdapter };
