import * as vscode from 'vscode';
import { DatabaseInfo, MySQLConnectionManager } from './mysqlConnection';

export class WebviewPanel {
    private static currentPanel: WebviewPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        private connectionManager: MySQLConnectionManager
    ) {
        this.panel = panel;
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // 📨 Setup message listener from webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                if (message.command === 'getTables') {
                    await this.handleGetTables(message.connectionId, message.databaseName);
                } else if (message.command === 'getColumns') {
                    await this.handleGetColumns(message.connectionId, message.databaseName, message.tableName);
                }
            },
            null,
            this.disposables
        );

        this.update();
    }

    public static createOrShow(
        extensionUri: vscode.Uri,
        connectionManager: MySQLConnectionManager
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (WebviewPanel.currentPanel) {
            WebviewPanel.currentPanel.panel.reveal(column);
            WebviewPanel.currentPanel.update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'mysqlDatabases',
            'MySQL Databases',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        WebviewPanel.currentPanel = new WebviewPanel(panel, connectionManager);
    }

    // 📬 Handle request for tables from webview
    private async handleGetTables(connectionId: string, databaseName: string) {
        try {
            const tables = await this.connectionManager.getTables(connectionId, databaseName);

            // Send tables back to webview
            this.panel.webview.postMessage({
                command: 'tablesData',
                connectionId,
                databaseName,
                tables: tables.map(t => ({ name: t.name }))
            });
        } catch (error) {
            // Send error back to webview
            this.panel.webview.postMessage({
                command: 'tablesData',
                connectionId,
                databaseName,
                tables: [],
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    // 📬 Handle request for columns from webview
    private async handleGetColumns(connectionId: string, databaseName: string, tableName: string) {
        try {
            const columns = await this.connectionManager.getColumns(connectionId, databaseName, tableName);

            // Send columns back to webview
            this.panel.webview.postMessage({
                command: 'columnsData',
                connectionId,
                databaseName,
                tableName,
                columns
            });
        } catch (error) {
            // Send error back to webview
            this.panel.webview.postMessage({
                command: 'columnsData',
                connectionId,
                databaseName,
                tableName,
                columns: [],
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async update() {
        this.panel.webview.html = await this.getHtmlContent();
    }

    private async getHtmlContent(): Promise<string> {
        const configs = this.connectionManager.getAllConnectionConfigs();

        let databasesHtml = '';

        for (const config of configs) {
            try {
                const databases = await this.connectionManager.getDatabases(config.id);

                databasesHtml += `
                    <div class="connection-group">
                        <div class="connection-header">
                            <svg class="connection-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                            </svg>
                            <div class="connection-info">
                                <h2>${this.escapeHtml(config.name)}</h2>
                                <p class="connection-details">${this.escapeHtml(config.user)}@${this.escapeHtml(config.host)}:${config.port}</p>
                            </div>
                        </div>
                        <div class="databases-list">
                            ${databases.map(db => `
                                <div class="database-item" data-connection-id="${this.escapeHtml(config.id)}" data-database-name="${this.escapeHtml(db.name)}">
                                    <div class="database-header-row">
                                        <div class="database-left">
                                            <svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <polyline points="9 18 15 12 9 6"/>
                                            </svg>
                                            <svg class="database-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                                                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                                                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                                            </svg>
                                            <div class="database-name">${this.escapeHtml(db.name)}</div>
                                        </div>
                                        <span class="badge">Expand</span>
                                    </div>
                                    <div class="tables-container">
                                        <div class="filter-wrapper">
                                            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <circle cx="11" cy="11" r="8"/>
                                                <path d="m21 21-4.35-4.35"/>
                                            </svg>
                                            <input 
                                                type="text" 
                                                class="table-filter" 
                                                placeholder="Filter tables..." 
                                                data-connection-id="${this.escapeHtml(config.id)}" 
                                                data-database-name="${this.escapeHtml(db.name)}"
                                            />
                                        </div>
                                        <div class="loading">Loading tables...</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            } catch (error) {
                databasesHtml += `
                    <div class="connection-group error">
                        <div class="connection-header">
                            <svg class="connection-icon error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            <div class="connection-info">
                                <h2>${this.escapeHtml(config.name)}</h2>
                                <p class="error-message">Failed to connect: ${this.escapeHtml(error instanceof Error ? error.message : String(error))}</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        if (configs.length === 0) {
            databasesHtml = `
                <div class="empty-state">
                    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="m21 21-4.35-4.35"/>
                    </svg>
                    <h2>No connections configured</h2>
                    <p>Add a MySQL connection to get started</p>
                </div>
            `;
        }

        return this.generateFullHtml(databasesHtml);
    }

    private generateFullHtml(databasesHtml: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MySQL Databases</title>
    ${this.getStyles()}
</head>
<body>
    <div class="container">
        <h1>MySQL Databases</h1>
        ${databasesHtml}
    </div>
    ${this.getScript()}
</body>
</html>`;
    }

    private getStyles(): string {
        return `<style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            padding: 24px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 32px;
            color: var(--vscode-foreground);
            letter-spacing: -0.02em;
        }

        /* ==================== CONNECTION GROUP ==================== */
        .connection-group {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            margin-bottom: 24px;
            overflow: hidden;
        }

        .connection-group.error {
            border-color: var(--vscode-errorForeground);
        }

        .connection-header {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 20px 24px;
            background: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .connection-icon {
            width: 20px;
            height: 20px;
            color: var(--vscode-foreground);
            flex-shrink: 0;
            pointer-events: none;
        }

        .connection-icon.error-icon {
            color: var(--vscode-errorForeground);
        }

        .connection-info h2 {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 2px;
            color: var(--vscode-foreground);
        }

        .connection-details {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
            letter-spacing: 0.01em;
        }

        .error-message {
            color: var(--vscode-errorForeground);
            font-size: 12px;
        }

        /* ==================== DATABASES LIST ==================== */
        .databases-list {
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .database-item {
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            overflow: hidden;
            transition: all 0.2s ease;
        }

        .database-item:hover {
            border-color: var(--vscode-focusBorder);
        }

        .database-header-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px;
            cursor: pointer;
            user-select: none;
            transition: background 0.15s ease;
        }

        .database-header-row:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .database-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .expand-icon {
            width: 14px;
            height: 14px;
            color: var(--vscode-descriptionForeground);
            transition: transform 0.2s ease;
            flex-shrink: 0;
            pointer-events: none;
        }

        .database-item.expanded .expand-icon {
            transform: rotate(90deg);
        }

        .database-icon {
            width: 18px;
            height: 18px;
            color: var(--vscode-symbolIcon-classForeground);
            flex-shrink: 0;
            pointer-events: none;
        }

        .database-name {
            font-size: 14px;
            font-weight: 500;
            color: var(--vscode-foreground);
        }

        .badge {
            font-size: 10px;
            padding: 4px 10px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 10px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .database-item.expanded .badge {
            display: none;
        }

        /* ==================== TABLES CONTAINER ==================== */
        .tables-container {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .database-item.expanded .tables-container {
            max-height: 600px;
            overflow-y: auto;
            overflow-x: hidden;
        }

        /* Filter */
        .filter-wrapper {
            padding: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editor-background);
            display: none;
            position: relative;
        }

        .database-item.expanded .filter-wrapper {
            display: block;
        }

        .search-icon {
            width: 14px;
            height: 14px;
            color: var(--vscode-descriptionForeground);
            position: absolute;
            left: 28px;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none;
        }

        .table-filter {
            width: 100%;
            padding: 8px 12px 8px 36px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 13px;
            outline: none;
            transition: border-color 0.15s ease;
        }

        .table-filter:focus {
            border-color: var(--vscode-focusBorder);
        }

        .table-filter::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        /* Tables Grid */
        .tables-grid {
            padding: 16px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 12px;
        }

        /* ==================== TABLE CARD ==================== */
        .table-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
            transition: all 0.2s ease;
        }

        .table-card:hover {
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .table-card.expanded {
            grid-column: 1 / -1;
        }

        .table-card-header {
            padding: 12px 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            user-select: none;
            transition: background 0.15s ease;
        }

        .table-card-header:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .table-card-left {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
        }

        .table-expand-icon {
            width: 12px;
            height: 12px;
            color: var(--vscode-descriptionForeground);
            transition: transform 0.2s ease;
            flex-shrink: 0;
            pointer-events: none;
        }

        .table-card.expanded .table-expand-icon {
            transform: rotate(90deg);
        }

        .table-icon {
            width: 16px;
            height: 16px;
            color: var(--vscode-symbolIcon-fileForeground);
            flex-shrink: 0;
            pointer-events: none;
        }

        .table-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 13px;
            font-weight: 500;
            color: var(--vscode-foreground);
        }

        /* ==================== COLUMNS CONTAINER ==================== */
        .columns-container {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
            opacity: 0;
        }

        .table-card.expanded .columns-container {
            max-height: 400px;
            overflow-y: auto;
            overflow-x: hidden;
            opacity: 1;
        }

        /* Custom Scrollbar */
        .tables-container::-webkit-scrollbar,
        .columns-container::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        .tables-container::-webkit-scrollbar-track,
        .columns-container::-webkit-scrollbar-track {
            background: transparent;
        }

        .tables-container::-webkit-scrollbar-thumb,
        .columns-container::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 4px;
        }

        .tables-container::-webkit-scrollbar-thumb:hover,
        .columns-container::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground);
        }

        /* Column Filter */
        .column-filter-wrapper {
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editor-background);
            position: relative;
        }

        .column-filter-wrapper .search-icon {
            left: 28px;
            top: 50%;
            transform: translateY(-50%);
        }

        .column-filter {
            width: 100%;
            padding: 6px 10px 6px 32px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 12px;
            outline: none;
            transition: border-color 0.15s ease;
        }

        .column-filter:focus {
            border-color: var(--vscode-focusBorder);
        }

        .column-filter::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        /* ==================== COLUMNS LIST ==================== */
        .columns-list {
            padding: 16px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 10px;
        }

        .column-item {
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            transition: all 0.15s ease;
        }

        .column-item:hover {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-hoverBackground);
        }

        .column-name {
            font-weight: 600;
            font-size: 13px;
            color: var(--vscode-symbolIcon-fieldForeground);
            margin-bottom: 8px;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
        }

        .column-details {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 6px 12px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .column-label {
            font-weight: 500;
            color: var(--vscode-foreground);
            opacity: 0.8;
        }

        .column-value {
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
            color: var(--vscode-descriptionForeground);
        }

        .column-value.key {
            color: var(--vscode-symbolIcon-keywordForeground);
            font-weight: 500;
        }

        .column-value.type {
            color: var(--vscode-symbolIcon-typeForeground);
        }

        /* ==================== LOADING & EMPTY STATE ==================== */
        .loading {
            padding: 32px 16px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
        }

        .empty-state {
            text-align: center;
            padding: 80px 20px;
        }

        .empty-icon {
            width: 48px;
            height: 48px;
            color: var(--vscode-descriptionForeground);
            margin: 0 auto 20px;
            opacity: 0.5;
        }

        .empty-state h2 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }

        .empty-state p {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }
    </style>`;
    }

    private getScript(): string {
        return `<script>
        (function() {
            const vscode = acquireVsCodeApi();
            const loadedDatabases = new Map();
            const loadedTables = new Map();

            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initializeEventListeners);
            } else {
                initializeEventListeners();
            }

            function initializeEventListeners() {
                console.log('Initializing database expansion listeners...');
                
                // Database expansion
                document.querySelectorAll('.database-item').forEach(item => {
                    const header = item.querySelector('.database-header-row');
                    
                    if (!header) {
                        console.error('No header found for database item:', item);
                        return;
                    }
                    
                    header.addEventListener('click', async () => {
                        const connectionId = item.dataset.connectionId;
                        const databaseName = item.dataset.databaseName;
                        const isExpanded = item.classList.contains('expanded');

                        console.log('Database clicked:', databaseName, 'Expanded:', isExpanded);

                        if (isExpanded) {
                            item.classList.remove('expanded');
                        } else {
                            item.classList.add('expanded');
                            
                            const key = connectionId + '::' + databaseName;
                            if (!loadedDatabases.has(key)) {
                                console.log('Loading tables for:', databaseName);
                                vscode.postMessage({
                                    command: 'getTables',
                                    connectionId: connectionId,
                                    databaseName: databaseName
                                });
                                loadedDatabases.set(key, true);
                            }
                        }
                    });
                });

                console.log('Found', document.querySelectorAll('.database-item').length, 'database items');

                // Event delegation for table filtering
                document.addEventListener('input', (e) => {
                    // Table filter
                    if (e.target.classList.contains('table-filter')) {
                        const filterValue = e.target.value.toLowerCase();
                        const connectionId = e.target.dataset.connectionId;
                        const databaseName = e.target.dataset.databaseName;
                        
                        const dbItem = document.querySelector(\`.database-item[data-connection-id="\${connectionId}"][data-database-name="\${databaseName}"]\`);
                        if (dbItem) {
                            const tables = dbItem.querySelectorAll('.table-card');
                            tables.forEach(table => {
                                const tableName = table.querySelector('.table-name').textContent.toLowerCase();
                                if (tableName.includes(filterValue)) {
                                    table.style.display = 'block';
                                } else {
                                    table.style.display = 'none';
                                }
                            });
                        }
                    }
                    
                    // Column filter
                    if (e.target.classList.contains('column-filter')) {
                        const filterValue = e.target.value.toLowerCase();
                        const tableCard = e.target.closest('.table-card');
                        if (tableCard) {
                            const columns = tableCard.querySelectorAll('.column-item');
                            columns.forEach(column => {
                                const columnName = column.querySelector('.column-name').textContent.toLowerCase();
                                if (columnName.includes(filterValue)) {
                                    column.style.display = 'block';
                                } else {
                                    column.style.display = 'none';
                                }
                            });
                        }
                    }
                });

                // Event delegation for table card clicks
                document.addEventListener('click', (e) => {
                    const tableHeader = e.target.closest('.table-card-header');
                    if (tableHeader) {
                        const tableCard = tableHeader.closest('.table-card');
                        const connectionId = tableCard.dataset.connectionId;
                        const databaseName = tableCard.dataset.databaseName;
                        const tableName = tableCard.dataset.tableName;
                        const isExpanded = tableCard.classList.contains('expanded');

                        if (isExpanded) {
                            tableCard.classList.remove('expanded');
                        } else {
                            tableCard.classList.add('expanded');
                            
                            const key = connectionId + '::' + databaseName + '::' + tableName;
                            if (!loadedTables.has(key)) {
                                vscode.postMessage({
                                    command: 'getColumns',
                                    connectionId: connectionId,
                                    databaseName: databaseName,
                                    tableName: tableName
                                });
                                loadedTables.set(key, true);
                            }
                        }
                    }
                });

                // Message handler
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    if (message.command === 'tablesData') {
                        const { connectionId, databaseName, tables } = message;
                        
                        const dbItem = document.querySelector(\`.database-item[data-connection-id="\${connectionId}"][data-database-name="\${databaseName}"]\`);
                        
                        if (dbItem) {
                            const container = dbItem.querySelector('.tables-container');
                            const filterWrapper = container.querySelector('.filter-wrapper');
                            
                            if (tables.length === 0) {
                                container.innerHTML = filterWrapper.outerHTML + '<div class="loading">No tables found</div>';
                            } else {
                                const tablesHtml = tables.map(table => \`
                                    <div class="table-card" 
                                         data-connection-id="\${connectionId}" 
                                         data-database-name="\${databaseName}" 
                                         data-table-name="\${table.name}">
                                        <div class="table-card-header">
                                            <div class="table-card-left">
                                                <svg class="table-expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <polyline points="9 18 15 12 9 6"/>
                                                </svg>
                                                <svg class="table-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                                    <line x1="3" y1="9" x2="21" y2="9"/>
                                                    <line x1="9" y1="21" x2="9" y2="9"/>
                                                </svg>
                                                <div class="table-name">\${table.name}</div>
                                            </div>
                                        </div>
                                        <div class="columns-container">
                                            <div class="loading">Loading columns...</div>
                                        </div>
                                    </div>
                                \`).join('');
                                
                                container.innerHTML = filterWrapper.outerHTML + '<div class="tables-grid">' + tablesHtml + '</div>';
                            }
                        }
                    }
                    
                    if (message.command === 'columnsData') {
                        const { connectionId, databaseName, tableName, columns } = message;
                        
                        const tableCard = document.querySelector(\`.table-card[data-connection-id="\${connectionId}"][data-database-name="\${databaseName}"][data-table-name="\${tableName}"]\`);
                        
                        if (tableCard) {
                            const columnsContainer = tableCard.querySelector('.columns-container');
                            
                            if (columns.length === 0) {
                                columnsContainer.innerHTML = '<div class="loading">No columns found</div>';
                            } else {
                                const columnsHtml = columns.map(col => \`
                                    <div class="column-item">
                                        <div class="column-name">\${col.name}</div>
                                        <div class="column-details">
                                            <span class="column-label">Type:</span>
                                            <span class="column-value type">\${col.type}</span>
                                            
                                            <span class="column-label">Nullable:</span>
                                            <span class="column-value">\${col.nullable}</span>
                                            
                                            <span class="column-label">Key:</span>
                                            <span class="column-value key">\${col.key || '-'}</span>
                                            
                                            <span class="column-label">Default:</span>
                                            <span class="column-value">\${col.default !== null ? col.default : 'NULL'}</span>
                                            
                                            <span class="column-label">Extra:</span>
                                            <span class="column-value">\${col.extra || '-'}</span>
                                        </div>
                                    </div>
                                \`).join('');
                                
                                columnsContainer.innerHTML = \`
                                    <div class="column-filter-wrapper">
                                        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <circle cx="11" cy="11" r="8"/>
                                            <path d="m21 21-4.35-4.35"/>
                                        </svg>
                                        <input 
                                            type="text" 
                                            class="column-filter" 
                                            placeholder="Filter columns..."
                                        />
                                    </div>
                                    <div class="columns-list">
                                        \${columnsHtml}
                                    </div>
                                \`;
                            }
                        }
                    }
                });
            }
        })(); // Close IIFE
    </script>`;
    }

    private escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    public dispose() {
        WebviewPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
