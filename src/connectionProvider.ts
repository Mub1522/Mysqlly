import * as vscode from 'vscode';
import { MySQLConnectionManager, ConnectionConfig, DatabaseInfo, TableInfo } from './mysqlConnection';

/* Level 1 */
export class ConnectionTreeItem extends vscode.TreeItem {
    constructor(
        public readonly config: ConnectionConfig,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly databases?: DatabaseInfo[]
    ) {
        super(config.name, collapsibleState);
        this.tooltip = `${config.host}:${config.port}`;
        this.description = `${config.user}@${config.host}:${config.port}`;
        this.contextValue = 'connection';
        this.iconPath = new vscode.ThemeIcon('database');
    }
}

/* Level 2 */
export class DatabaseTreeItem extends vscode.TreeItem {
    constructor(
        public readonly database: DatabaseInfo
    ) {
        super(database.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'database';
        this.iconPath = new vscode.ThemeIcon('folder-library');
    }
}

/* Level 3 - Tabla */
export class TableTreeItem extends vscode.TreeItem {
    constructor(
        public readonly table: TableInfo  // Info de la tabla
    ) {
        // super() llama al constructor de la clase padre (TreeItem)
        super(table.name, vscode.TreeItemCollapsibleState.None);

        // Propiedades de visualización
        this.tooltip = `Table: ${table.name}`;
        this.contextValue = 'table';  // Para menús contextuales
        this.iconPath = new vscode.ThemeIcon('symbol-field');  // Icono de tabla
    }
}

/* Level 4 */
export class ConnectionProvider implements vscode.TreeDataProvider<ConnectionTreeItem | DatabaseTreeItem | TableTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConnectionTreeItem | DatabaseTreeItem | undefined | null | void> =
        new vscode.EventEmitter<ConnectionTreeItem | DatabaseTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConnectionTreeItem | DatabaseTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    constructor(private connectionManager: MySQLConnectionManager) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ConnectionTreeItem | DatabaseTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ConnectionTreeItem | DatabaseTreeItem | TableTreeItem): Promise<(ConnectionTreeItem | DatabaseTreeItem | TableTreeItem)[]> {
        if (!element) {
            // Root level: show all connections
            const configs = this.connectionManager.getAllConnectionConfigs();
            return configs.map(config =>
                new ConnectionTreeItem(
                    config,
                    vscode.TreeItemCollapsibleState.Collapsed
                )
            );
        } else if (element instanceof ConnectionTreeItem) {
            // Show databases for this connection
            try {
                const databases = await this.connectionManager.getDatabases(element.config.id);
                return databases.map(db => new DatabaseTreeItem(db));
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to fetch databases: ${error instanceof Error ? error.message : String(error)}`
                );
                return [];
            }
        } else if (element instanceof DatabaseTreeItem) {
            // Show tables for this database
            try {
                const tables = await this.connectionManager.getTables(
                    element.database.connectionId,
                    element.database.name
                );
                return tables.map(table => new TableTreeItem(table));
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to fetch tables: ${error instanceof Error ? error.message : String(error)}`
                );
                return [];
            }
        }
        return [];
    }
}
