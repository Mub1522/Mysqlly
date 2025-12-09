(function () {
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

        // ==================== SETTINGS PANEL ====================
        const settingsBtn = document.getElementById('settings-btn');
        const settingsPanel = document.getElementById('settings-panel');
        const closeSettings = document.getElementById('close-settings');

        if (settingsBtn && settingsPanel && closeSettings) {
            settingsBtn.addEventListener('click', () => {
                settingsPanel.classList.add('open');
            });

            closeSettings.addEventListener('click', () => {
                settingsPanel.classList.remove('open');
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (settingsPanel.classList.contains('open') &&
                    !settingsPanel.contains(e.target) &&
                    !settingsBtn.contains(e.target)) {
                    settingsPanel.classList.remove('open');
                }
            });
        }

        // ==================== VIEW TOGGLE ====================
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Toggle active class on buttons
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Toggle body class based on view
                if (btn.dataset.view === 'list') {
                    document.body.classList.add('list-view');
                } else {
                    document.body.classList.remove('list-view');
                }
            });
        });

        // ==================== COLUMN DETAILS TOGGLE ====================
        const columnDetailsCheckbox = document.getElementById('show-column-details');
        if (columnDetailsCheckbox) {
            columnDetailsCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    document.body.classList.remove('hide-column-details');
                } else {
                    document.body.classList.add('hide-column-details');
                }
            });
        }

        // ==================== DATA VIEWER ====================
        let currentDataContext = { connectionId: '', databaseName: '', tableName: '', currentPage: 0, totalPages: 1 };

        const dataViewerModal = document.getElementById('data-viewer-modal');
        const dataViewerContent = document.getElementById('data-viewer-content');
        const dataViewerTitle = document.getElementById('data-viewer-title');
        const closeDataViewer = document.getElementById('close-data-viewer');
        const prevPageBtn = document.getElementById('prev-page');
        const nextPageBtn = document.getElementById('next-page');
        const paginationInfo = document.getElementById('pagination-info');

        // Open data viewer
        function openDataViewer(connectionId, databaseName, tableName) {
            currentDataContext = { connectionId, databaseName, tableName, currentPage: 0, totalPages: 1 };
            dataViewerTitle.textContent = `${tableName} - Data`;
            dataViewerModal.classList.add('open');
            dataViewerContent.innerHTML = '<div class="loading">Loading data...</div>';
            loadTableData(0);
        }

        // Load table data
        function loadTableData(page) {
            currentDataContext.currentPage = page;
            dataViewerContent.innerHTML = '<div class="loading">Loading data...</div>';
            vscode.postMessage({
                command: 'getTableData',
                connectionId: currentDataContext.connectionId,
                databaseName: currentDataContext.databaseName,
                tableName: currentDataContext.tableName,
                page: page
            });
        }

        // Close data viewer
        function closeDataViewerModal() {
            dataViewerModal.classList.remove('open');
        }

        if (closeDataViewer) {
            closeDataViewer.addEventListener('click', closeDataViewerModal);
        }

        // Close on outside click
        if (dataViewerModal) {
            dataViewerModal.addEventListener('click', (e) => {
                if (e.target === dataViewerModal) {
                    closeDataViewerModal();
                }
            });
        }

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && dataViewerModal.classList.contains('open')) {
                closeDataViewerModal();
            }
        });

        // View Data button clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.view-data-btn')) {
                e.stopPropagation(); // Prevent table expansion
                const btn = e.target.closest('.view-data-btn');
                const connectionId = btn.dataset.connectionId;
                const databaseName = btn.dataset.databaseName;
                const tableName = btn.dataset.tableName;
                openDataViewer(connectionId, databaseName, tableName);
            }
        });

        // Pagination
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (currentDataContext.currentPage > 0) {
                    loadTableData(currentDataContext.currentPage - 1);
                }
            });
        }

        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                if (currentDataContext.currentPage < currentDataContext.totalPages - 1) {
                    loadTableData(currentDataContext.currentPage + 1);
                }
            });
        }

        // ==================== JSON VIEWER ====================
        // Create JSON viewer modal dynamically
        const jsonViewerHTML = `
            <div class="json-viewer-modal" id="json-viewer-modal">
                <div class="json-viewer-container">
                    <div class="json-viewer-header">
                        <h3>JSON Viewer</h3>
                        <div class="json-viewer-actions">
                            <button class="json-copy-btn" id="json-copy-btn" title="Copy JSON">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                            </button>
                            <button class="close-btn" id="close-json-viewer">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="json-viewer-content">
                        <pre id="json-viewer-pre"></pre>
                    </div>
                </div>
            </div>
        `;

        // Add to body if not exists
        if (!document.getElementById('json-viewer-modal')) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = jsonViewerHTML;
            document.body.appendChild(tempDiv.firstElementChild);
        }

        const jsonViewerModal = document.getElementById('json-viewer-modal');
        const jsonViewerPre = document.getElementById('json-viewer-pre');
        const closeJsonViewer = document.getElementById('close-json-viewer');
        const jsonCopyBtn = document.getElementById('json-copy-btn');
        let currentJsonData = '';

        // Syntax highlight JSON
        function syntaxHighlightJSON(json) {
            json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
                let cls = 'json-number';
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = 'json-key';
                    } else {
                        cls = 'json-string';
                    }
                } else if (/true|false/.test(match)) {
                    cls = 'json-boolean';
                } else if (/null/.test(match)) {
                    cls = 'json-null';
                }
                return '<span class="' + cls + '">' + match + '</span>';
            });
        }

        // Open JSON viewer
        function openJsonViewer(jsonStr) {
            try {
                const jsonObj = JSON.parse(jsonStr);
                const formatted = JSON.stringify(jsonObj, null, 2);
                currentJsonData = formatted;
                jsonViewerPre.innerHTML = syntaxHighlightJSON(formatted);
                jsonViewerModal.classList.add('open');
            } catch (e) {
                jsonViewerPre.innerHTML = `<span style="color: var(--vscode-errorForeground);">Error parsing JSON: ${e.message}</span>`;
                jsonViewerModal.classList.add('open');
            }
        }

        // Close JSON viewer
        if (closeJsonViewer) {
            closeJsonViewer.addEventListener('click', () => {
                jsonViewerModal.classList.remove('open');
            });
        }

        // Copy JSON
        if (jsonCopyBtn) {
            jsonCopyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(currentJsonData);
                    jsonCopyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
                    setTimeout(() => {
                        jsonCopyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
                    }, 1500);
                } catch (e) {
                    console.error('Failed to copy:', e);
                }
            });
        }

        // Close on outside click
        if (jsonViewerModal) {
            jsonViewerModal.addEventListener('click', (e) => {
                if (e.target === jsonViewerModal) {
                    jsonViewerModal.classList.remove('open');
                }
            });
        }

        // Handle JSON badge clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.json-badge')) {
                const badge = e.target.closest('.json-badge');
                const jsonStr = badge.dataset.json;
                openJsonViewer(jsonStr);
            }
        });

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

                const dbItem = document.querySelector(`.database-item[data-connection-id="${connectionId}"][data-database-name="${databaseName}"]`);
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

                const dbItem = document.querySelector(`.database-item[data-connection-id="${connectionId}"][data-database-name="${databaseName}"]`);

                if (dbItem) {
                    const container = dbItem.querySelector('.tables-container');
                    const filterWrapper = container.querySelector('.filter-wrapper');

                    if (tables.length === 0) {
                        container.innerHTML = filterWrapper.outerHTML + '<div class="loading">No tables found</div>';
                    } else {
                        const tablesHtml = tables.map(table => `
                            <div class="table-card" 
                                 data-connection-id="${connectionId}" 
                                 data-database-name="${databaseName}" 
                                 data-table-name="${table.name}">
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
                                        <div class="table-name">${table.name}</div>
                                    </div>
                                    <button class="view-data-btn" title="View Data" 
                                            data-connection-id="${connectionId}"
                                            data-database-name="${databaseName}"
                                            data-table-name="${table.name}">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    </button>
                                </div>
                                <div class="columns-container">
                                    <div class="loading">Loading columns...</div>
                                </div>
                            </div>
                        `).join('');

                        container.innerHTML = filterWrapper.outerHTML + '<div class="tables-grid">' + tablesHtml + '</div>';
                    }
                }
            }

            if (message.command === 'columnsData') {
                const { connectionId, databaseName, tableName, columns } = message;

                const tableCard = document.querySelector(`.table-card[data-connection-id="${connectionId}"][data-database-name="${databaseName}"][data-table-name="${tableName}"]`);

                if (tableCard) {
                    const columnsContainer = tableCard.querySelector('.columns-container');

                    if (columns.length === 0) {
                        columnsContainer.innerHTML = '<div class="loading">No columns found</div>';
                    } else {
                        const columnsHtml = columns.map(col => `
                            <div class="column-item">
                                <div class="column-name">${col.name}</div>
                                <div class="column-details">
                                    <span class="column-label">Type:</span>
                                    <span class="column-value type">${col.type}</span>
                                    
                                    <span class="column-label">Nullable:</span>
                                    <span class="column-value">${col.nullable}</span>
                                    
                                    <span class="column-label">Key:</span>
                                    <span class="column-value key">${col.key || '-'}</span>
                                    
                                    <span class="column-label">Default:</span>
                                    <span class="column-value">${col.default !== null ? col.default : 'NULL'}</span>
                                    
                                    <span class="column-label">Extra:</span>
                                    <span class="column-value">${col.extra || '-'}</span>
                                </div>
                            </div>
                        `).join('');

                        columnsContainer.innerHTML = `
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
                                ${columnsHtml}
                            </div>
                        `;
                    }
                }
            }

            // Handle table data response
            if (message.command === 'tableData') {
                const { rows, columns, page, totalPages, totalRows, error } = message;

                if (error) {
                    dataViewerContent.innerHTML = `<div class="loading" style="color: var(--vscode-errorForeground);">Error: ${error}</div>`;
                    return;
                }

                if (rows.length === 0) {
                    dataViewerContent.innerHTML = '<div class="loading">No data found</div>';
                    prevPageBtn.disabled = true;
                    nextPageBtn.disabled = true;
                    paginationInfo.textContent = 'No rows';
                    return;
                }

                // Render table
                let tableHtml = '<table class="data-table"><thead><tr>';
                columns.forEach(col => {
                    tableHtml += `<th>${col}</th>`;
                });
                tableHtml += '</tr></thead><tbody>';

                rows.forEach((row, rowIndex) => {
                    tableHtml += '<tr>';
                    columns.forEach(col => {
                        const value = row[col];
                        if (value === null) {
                            tableHtml += '<td class="null-value">NULL</td>';
                        } else if (typeof value === 'object') {
                            // Handle JSON objects/arrays - show badge instead of raw JSON
                            const jsonStr = JSON.stringify(value);
                            const isArray = Array.isArray(value);
                            const icon = isArray ? '[ ]' : '{ }';
                            const type = isArray ? 'Array' : 'Object';
                            tableHtml += `<td>
                                <button class="json-badge" data-json="${jsonStr.replace(/"/g, '&quot;')}" title="Click to view JSON">
                                    <span class="json-icon">${icon}</span>
                                    <span class="json-type">${type}</span>
                                </button>
                            </td>`;
                        } else {
                            tableHtml += `<td>${String(value)}</td>`;
                        }
                    });
                    tableHtml += '</tr>';
                });

                tableHtml += '</tbody></table>';
                dataViewerContent.innerHTML = tableHtml;

                // Update pagination
                currentDataContext.totalPages = totalPages;
                prevPageBtn.disabled = page === 0;
                nextPageBtn.disabled = page >= totalPages - 1;
                paginationInfo.textContent = `Page ${page + 1} of ${totalPages} (${totalRows} rows)`;
            }
        });
    }
})();
