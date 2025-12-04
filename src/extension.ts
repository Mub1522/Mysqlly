import * as vscode from 'vscode';
import { MySQLConnectionManager } from './mysqlConnection';
import { ConnectionProvider, ConnectionTreeItem } from './connectionProvider';
import { WebviewPanel } from './webviewPanel';

let connectionManager: MySQLConnectionManager;
let connectionProvider: ConnectionProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Mysqlly extension is now active');

    // Initialize connection manager
    connectionManager = new MySQLConnectionManager(context);

    // Initialize tree view provider
    connectionProvider = new ConnectionProvider(connectionManager);
    const treeView = vscode.window.createTreeView('mysqlConnections', {
        treeDataProvider: connectionProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // Register commands
    const addConnectionCommand = vscode.commands.registerCommand('mysqlly.addConnection', async () => {
        const name = await vscode.window.showInputBox({
            prompt: 'Connection Name',
            placeHolder: 'e.g., Local MySQL, Production DB'
        });
        if (!name) {
            return;
        }

        const host = await vscode.window.showInputBox({
            prompt: 'Host / IP Address',
            placeHolder: 'e.g., localhost, 192.168.1.100',
            value: 'localhost'
        });
        if (!host) {
            return;
        }

        const portStr = await vscode.window.showInputBox({
            prompt: 'Port',
            placeHolder: '3306',
            value: '3306',
            validateInput: (value) => {
                const port = parseInt(value);
                if (isNaN(port) || port < 1 || port > 65535) {
                    return 'Please enter a valid port number (1-65535)';
                }
                return null;
            }
        });
        if (!portStr) {
            return;
        }
        const port = parseInt(portStr);

        const user = await vscode.window.showInputBox({
            prompt: 'Username',
            placeHolder: 'e.g., root',
            value: 'root'
        });
        if (!user) {
            return;
        }

        const password = await vscode.window.showInputBox({
            prompt: 'Password',
            password: true,
            placeHolder: 'Enter password'
        });
        if (password === undefined) {
            return;
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Testing MySQL connection...',
                cancellable: false
            }, async () => {
                await connectionManager.addConnection(name, host, port, user, password);
            });

            vscode.window.showInformationMessage(`Connection "${name}" added successfully!`);
            connectionProvider.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to add connection: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    const deleteConnectionCommand = vscode.commands.registerCommand('mysqlly.deleteConnection', async (item: ConnectionTreeItem) => {
        const confirm = await vscode.window.showWarningMessage(
            `Delete connection "${item.config.name}"?`,
            { modal: true },
            'Delete'
        );

        if (confirm === 'Delete') {
            try {
                await connectionManager.removeConnection(item.config.id);
                vscode.window.showInformationMessage(`Connection "${item.config.name}" deleted`);
                connectionProvider.refresh();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to delete connection: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    });

    const refreshCommand = vscode.commands.registerCommand('mysqlly.refreshConnections', () => {
        connectionProvider.refresh();
        vscode.window.showInformationMessage('Connections refreshed');
    });

    const showDatabasesCommand = vscode.commands.registerCommand('mysqlly.showDatabases', () => {
        WebviewPanel.createOrShow(context.extensionUri, connectionManager);
    });

    context.subscriptions.push(
        addConnectionCommand,
        deleteConnectionCommand,
        refreshCommand,
        showDatabasesCommand
    );
}

export async function deactivate() {
    if (connectionManager) {
        await connectionManager.closeAll();
    }
}
