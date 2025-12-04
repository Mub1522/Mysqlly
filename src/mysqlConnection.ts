import { Console } from 'console';
import * as mysql from 'mysql2/promise';
import * as vscode from 'vscode';

export interface ConnectionConfig {
    id: string;
    name: string;
    host: string;
    port: number;
    user: string;
    password: string;
}

export interface DatabaseInfo {
    name: string;
    connectionId: string;
}

export interface TableInfo {
    name: string;
    databaseName: string;
    connectionId: string;
}

export interface ColumnInfo {
    name: string;
    type: string;
    nullable: string;
    key: string;
    default: string | null;
    extra: string;
}

export class MySQLConnectionManager {
    private connections: Map<string, mysql.Connection> = new Map();
    private configs: Map<string, ConnectionConfig> = new Map();
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadConnections();
    }

    private async loadConnections() {
        const storedConfigs = this.context.globalState.get<ConnectionConfig[]>('mysqlConnections', []);

        for (const config of storedConfigs) {
            this.configs.set(config.id, config);
            // Load password from secret storage
            const password = await this.context.secrets.get(`mysql-password-${config.id}`);
            if (password) {
                config.password = password;
            }
        }
    }

    async addConnection(name: string, host: string, port: number, user: string, password: string): Promise<string> {
        const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

        const config: ConnectionConfig = {
            id,
            name,
            host,
            port,
            user,
            password
        };

        // Test connection first
        try {
            const testConnection = await mysql.createConnection({
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password
            });
            await testConnection.end();
        } catch (error) {
            throw new Error(`Failed to connect to MySQL: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Store config (without password in global state)
        this.configs.set(id, config);
        const configsToStore = Array.from(this.configs.values()).map(c => ({
            ...c,
            password: '' // Don't store password in global state
        }));
        await this.context.globalState.update('mysqlConnections', configsToStore);

        // Store password in secret storage
        await this.context.secrets.store(`mysql-password-${id}`, password);

        return id;
    }

    async removeConnection(id: string): Promise<void> {
        // Close connection if open
        const connection = this.connections.get(id);
        if (connection) {
            await connection.end();
            this.connections.delete(id);
        }

        // Remove config
        this.configs.delete(id);
        const configsToStore = Array.from(this.configs.values()).map(c => ({
            ...c,
            password: ''
        }));
        await this.context.globalState.update('mysqlConnections', configsToStore);

        // Remove password from secret storage
        await this.context.secrets.delete(`mysql-password-${id}`);
    }

    async getConnection(id: string): Promise<mysql.Connection> {
        // Return existing connection if available
        if (this.connections.has(id)) {
            return this.connections.get(id)!;
        }

        // Create new connection
        const config = this.configs.get(id);
        if (!config) {
            throw new Error(`Connection configuration not found for id: ${id}`);
        }

        const connection = await mysql.createConnection({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password
        });

        this.connections.set(id, connection);
        return connection;
    }

    async getDatabases(connectionId: string): Promise<DatabaseInfo[]> {
        const connection = await this.getConnection(connectionId);
        const [rows] = await connection.query('SHOW DATABASES');

        const databases = (rows as any[])
            .map(row => row.Database || row.database)
            .filter(db => !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(db))
            .map(name => ({
                name,
                connectionId
            }));

        return databases;
    }

    /* Get tables database */
    async getTables(connectionId: string, databaseName: string): Promise<TableInfo[]> {
        const connection = await this.getConnection(connectionId);
        await connection.query(`USE ${databaseName}`);

        const [rows] = await connection.query('SHOW TABLES');
        const tables = (rows as any[]).map(row => {
            console.log(row);

            const tableName = Object.values(row)[0] as string;
            return {
                name: tableName,
                databaseName: databaseName,
                connectionId: connectionId
            };
        });

        return tables;
    }

    /* Get columns from a table */
    async getColumns(connectionId: string, databaseName: string, tableName: string): Promise<ColumnInfo[]> {
        const connection = await this.getConnection(connectionId);
        await connection.query(`USE ${databaseName}`);

        const [rows] = await connection.query(`DESCRIBE ${tableName}`);
        const columns = (rows as any[]).map(row => ({
            name: row.Field,
            type: row.Type,
            nullable: row.Null,
            key: row.Key,
            default: row.Default,
            extra: row.Extra
        }));

        return columns;
    }

    getAllConnectionConfigs(): ConnectionConfig[] {
        return Array.from(this.configs.values());
    }

    getConnectionConfig(id: string): ConnectionConfig | undefined {
        return this.configs.get(id);
    }

    async closeAll(): Promise<void> {
        for (const [id, connection] of this.connections) {
            try {
                await connection.end();
            } catch (error) {
                console.error(`Error closing connection ${id}:`, error);
            }
        }
        this.connections.clear();
    }
}
