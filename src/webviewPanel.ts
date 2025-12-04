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
                            <div class="connection-icon">🔌</div>
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
                                            <span class="expand-icon">▶</span>
                                            <div class="database-icon">🗄️</div>
                                            <div class="database-name">${this.escapeHtml(db.name)}</div>
                                        </div>
                                        <div class="badge">Click to expand</div>
                                    </div>
                                    <div class="tables-container">
                                    <div class="tables-container">
                                            <div class="filter-wrapper">
                                                <input 
                                                    type="text" 
                                                    class="table-filter" 
                                                    placeholder="🔍 Filter tables..." 
                                                    data-connection-id="${this.escapeHtml(config.id)}" 
                                                    data-database-name="${this.escapeHtml(db.name)}"
                                                />
                                            </div>
                                            <div class="loading">Loading tables...</div>
                                        </div>
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
                            <div class="connection-icon">⚠️</div>
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
                    <div class="empty-icon">🔍</div>
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        h1 {
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 24px;
            color: var(--vscode-foreground);
        }

        .connection-group {
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
        }

        .connection-group.error {
            border-color: var(--vscode-errorForeground);
        }

        .connection-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .connection-icon {
            font-size: 24px;
        }

        .connection-info h2 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 4px;
        }

        .connection-details {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            font-family: 'Courier New', monospace;
        }

        .error-message {
            color: var(--vscode-errorForeground);
            font-size: 13px;
        }

        .databases-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .database-item {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            overflow: hidden;
            transition: border-color 0.2s ease;
        }

        /* Solo aplicar hover al header, no al contenedor completo */
        .database-item:has(.database-header-row:hover):not(:has(.table-card:hover)) {
            border-color: var(--vscode-focusBorder);
        }

        .database-header-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            cursor: pointer;
            user-select: none;
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
            font-size: 12px;
            transition: transform 0.2s ease;
            color: var(--vscode-descriptionForeground);
        }

        .database-item.expanded .expand-icon {
            transform: rotate(90deg);
        }

        .database-icon {
            font-size: 20px;
        }

        .database-name {
            font-size: 14px;
            font-weight: 500;
        }

        .badge {
            font-size: 11px;
            padding: 4px 8px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 12px;
        }

        .database-item.expanded .badge {
            display: none;
        }

        .tables-container {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
        }

        .loading {
            padding: 16px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
        }

        .tables-grid {
            padding: 12px 16px 16px 16px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 8px;
            overflow-y: auto;
            overflow-x: auto;
        }

        .table-card {
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
            transition: border-color 0.3s ease;
        }

        /* Solo aplicar hover cuando está directamente sobre la tabla */
        .table-card:hover {
            border-color: var(--vscode-focusBorder);
        }

        /* Cuando la tabla está expandida, ocupa todo el ancho */
        .table-card.expanded {
            grid-column: 1 / -1;
        }

        .table-card-header {
            padding: 10px 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            user-select: none;
        }

        .table-card-header:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .table-card-left {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .table-expand-icon {
            font-size: 10px;
            transition: transform 0.2s ease;
            color: var(--vscode-descriptionForeground);
        }

        .table-card.expanded .table-expand-icon {
            transform: rotate(90deg);
        }

        .table-icon {
            font-size: 16px;
        }

        .table-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 13px;
            font-weight: 500;
        }

        .columns-container {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
            opacity: 0;
        }

        .table-card.expanded .columns-container {
            max-height: 300px;
            height: auto;
            overflow-y: auto;
            overflow-x: auto;
            opacity: 1;
            display: block;
        }

        /* Scrollbar personalizado para el contenedor de columnas */
        .table-card.expanded .columns-container::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }

        .table-card.expanded .columns-container::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 4px;
        }

        .table-card.expanded .columns-container::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-hoverBackground);
            border-radius: 4px;
        }

        .table-card.expanded .columns-container::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-activeBackground);
        }

        .column-filter-wrapper {
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editor-background);
        }

        .column-filter {
            width: 100%;
            padding: 5px 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            font-size: 12px;
            outline: none;
        }

        .column-filter:focus {
            border-color: var(--vscode-focusBorder);
        }

        .columns-list {
            padding: 8px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 8px;
        }

        .column-item {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            padding: 10px;
            font-size: 12px;
            transition: all 0.2s ease;
        }

        .column-item:hover {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-hoverBackground);
        }

        .column-name {
            font-weight: 600;
            color: var(--vscode-symbolIcon-fieldForeground);
            margin-bottom: 4px;
        }

        .column-details {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 4px 8px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .column-label {
            font-weight: 500;
            color: var(--vscode-foreground);
        }

        .column-value {
            font-family: 'Courier New', monospace;
        }

        .column-value.key {
            color: var(--vscode-symbolIcon-keywordForeground);
        }

        .column-value.type {
            color: var(--vscode-symbolIcon-typeForeground);
        }

        .empty-state {
            text-align: center;
            padding: 60px 20px;
        }

        .empty-icon {
            font-size: 64px;
            margin-bottom: 16px;
        }

        .empty-state h2 {
            font-size: 20px;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }

        .empty-state p {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }

        /* Filter */
        .filter-wrapper {
            padding: 12px 16px 8px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: none;
        }

        .database-item.expanded .filter-wrapper {
            display: block;
        }

        .table-filter {
            width: 100%;
            padding: 6px 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 13px;
            outline: none;
        }

        .table-filter:focus {
            border-color: var(--vscode-focusBorder);
        }

        .database-item.expanded .tables-container {
            max-height: 400px; /* Altura fija para el overflow */
            overflow-y: auto;
            display: flex;
            flex-direction: column;
        }

        .tables-container::-webkit-scrollbar {
            width: 8px;
        }

        .tables-container::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
        }

        .tables-container::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-hoverBackground);
            border-radius: 4px;
        }
    </style>`;
    }

    private getScript(): string {
        return `<script>
        const vscode = acquireVsCodeApi();
        const loadedDatabases = new Map();
        const loadedTables = new Map();

        // Database expansion
        document.querySelectorAll('.database-item').forEach(item => {
            const header = item.querySelector('.database-header-row');
            
            header.addEventListener('click', async () => {
                const connectionId = item.dataset.connectionId;
                const databaseName = item.dataset.databaseName;
                const isExpanded = item.classList.contains('expanded');

                if (isExpanded) {
                    item.classList.remove('expanded');
                } else {
                    item.classList.add('expanded');
                    
                    const key = connectionId + '::' + databaseName;
                    if (!loadedDatabases.has(key)) {
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
                                        <span class="table-expand-icon">▶</span>
                                        <div class="table-icon">📋</div>
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
                                <input 
                                    type="text" 
                                    class="column-filter" 
                                    placeholder="🔍 Filter columns..."
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
