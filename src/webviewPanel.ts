import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseInfo, MySQLConnectionManager } from './mysqlConnection';

export class WebviewPanel {
    private static currentPanel: WebviewPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        private connectionManager: MySQLConnectionManager
    ) {
        this.extensionUri = extensionUri;
        this.panel = panel;
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // 📨 Setup message listener from webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                if (message.command === 'getTables') {
                    await this.handleGetTables(message.connectionId, message.databaseName);
                } else if (message.command === 'getColumns') {
                    await this.handleGetColumns(message.connectionId, message.databaseName, message.tableName);
                } else if (message.command === 'getTableData') {
                    await this.handleGetTableData(message.connectionId, message.databaseName, message.tableName, message.page || 0);
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
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'src', 'webview')]
            }
        );

        WebviewPanel.currentPanel = new WebviewPanel(panel, extensionUri, connectionManager);
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

    // 📬 Handle request for table data with pagination
    private async handleGetTableData(connectionId: string, databaseName: string, tableName: string, page: number) {
        try {
            const pageSize = 25;
            const offset = page * pageSize;
            const connection = await this.connectionManager.getConnection(connectionId);
            await connection.query(`USE \`${databaseName}\``);

            // Get total count
            const [countResult] = await connection.query(`SELECT COUNT(*) as total FROM \`${tableName}\``);
            const totalRows = (countResult as any[])[0]?.total || 0;

            // Get paginated data
            const [rows] = await connection.query(`SELECT * FROM \`${tableName}\` LIMIT ${pageSize} OFFSET ${offset}`);

            // Get column names
            const columns = (rows as any[]).length > 0 ? Object.keys((rows as any[])[0]) : [];

            // Send data back to webview
            this.panel.webview.postMessage({
                command: 'tableData',
                connectionId,
                databaseName,
                tableName,
                rows,
                columns,
                page,
                pageSize,
                totalRows,
                totalPages: Math.ceil(totalRows / pageSize)
            });
        } catch (error) {
            // Send error back to webview
            this.panel.webview.postMessage({
                command: 'tableData',
                connectionId,
                databaseName,
                tableName,
                rows: [],
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
        const stylesUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'styles.css')
        );
        const scriptUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'main.js')
        );

        return `<!DOCTYPE html>
                <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource}; script-src ${this.panel.webview.cspSource};">
                        <title>MySQL Databases</title>
                        <link rel="stylesheet" href="${stylesUri}">
                    </head>
                    <body>
                        <div class="container">
                            <div class="header-bar">
                                <h1>MySQL Databases</h1>
                                <button class="settings-btn" id="settings-btn" title="Settings">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="3"/>
                                        <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
                                    </svg>
                                </button>
                            </div>
                            
                            <!-- Settings Panel -->
                            <div class="settings-panel" id="settings-panel">
                                <div class="settings-header">
                                    <h3>View Settings</h3>
                                    <button class="close-btn" id="close-settings">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="18" y1="6" x2="6" y2="18"/>
                                            <line x1="6" y1="6" x2="18" y2="18"/>
                                        </svg>
                                    </button>
                                </div>
                                <div class="settings-content">
                                    <div class="setting-group">
                                        <label class="setting-label">Table View</label>
                                        <div class="view-toggle">
                                            <button class="view-btn active" data-view="grid">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <rect x="3" y="3" width="7" height="7"/>
                                                    <rect x="14" y="3" width="7" height="7"/>
                                                    <rect x="3" y="14" width="7" height="7"/>
                                                    <rect x="14" y="14" width="7" height="7"/>
                                                </svg>
                                                Grid
                                            </button>
                                            <button class="view-btn" data-view="list">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <line x1="8" y1="6" x2="21" y2="6"/>
                                                    <line x1="8" y1="12" x2="21" y2="12"/>
                                                    <line x1="8" y1="18" x2="21" y2="18"/>
                                                    <line x1="3" y1="6" x2="3.01" y2="6"/>
                                                    <line x1="3" y1="12" x2="3.01" y2="12"/>
                                                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                                                </svg>
                                                List
                                            </button>
                                        </div>
                                    </div>
                                    <div class="setting-group">
                                        <label class="checkbox-label">
                                            <input type="checkbox" id="show-column-details" checked>
                                            <span>Show column details</span>
                                        </label>
                                        <p class="setting-description">Display type, nullable, key, default and extra info for columns</p>
                                    </div>
                                </div>
                            </div>
                            
                            ${databasesHtml}
                        </div>
                        
                        <!-- Data Viewer Modal -->
                        <div class="data-viewer-modal" id="data-viewer-modal">
                            <div class="data-viewer-container">
                                <div class="data-viewer-header">
                                    <h2 id="data-viewer-title">Table Data</h2>
                                    <button class="close-btn" id="close-data-viewer">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="18" y1="6" x2="6" y2="18"/>
                                            <line x1="6" y1="6" x2="18" y2="18"/>
                                        </svg>
                                    </button>
                                </div>
                                <div class="data-viewer-content" id="data-viewer-content">
                                    <div class="loading">Loading data...</div>
                                </div>
                                <div class="data-viewer-footer">
                                    <div class="pagination">
                                        <button id="prev-page" class="pagination-btn" disabled>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <polyline points="15 18 9 12 15 6"/>
                                            </svg>
                                            Previous
                                        </button>
                                        <span id="pagination-info">Page 1 of 1</span>
                                        <button id="next-page" class="pagination-btn" disabled>
                                            Next
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <polyline points="9 18 15 12 9 6"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <script src="${scriptUri}"></script>
                    </body>
                </html>`;
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
