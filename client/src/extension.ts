import * as path from 'path';
import { workspace, ExtensionContext, window, OutputChannel } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;
let outputChannel: OutputChannel;

export function activate(context: ExtensionContext) {
    outputChannel = window.createOutputChannel('WebRelease2 Template LSP');
    
    // Get the server module path (Node.js based)
    const serverModule = context.asAbsolutePath(
        path.join('server', 'out', 'server.js')
    );
    
    outputChannel.appendLine(`Server module: ${serverModule}`);
    
    // Server options - using Node.js IPC transport
    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: {
                execArgv: ['--nolazy', '--inspect=6009']
            }
        }
    };
    
    // Client options
    const clientOptions: LanguageClientOptions = {
        // Register the server for WebRelease2 template documents
        documentSelector: [
            { scheme: 'file', language: 'webrelease2' },
            { scheme: 'file', pattern: '**/*.wr2' },
            { scheme: 'file', pattern: '**/*.wrt' }
        ],
        synchronize: {
            // Notify the server about file changes
            fileEvents: workspace.createFileSystemWatcher('**/*.{wr2,wrt}')
        },
        outputChannel: outputChannel,
    };
    
    // Create the language client
    client = new LanguageClient(
        'webrelease2-lsp',
        'WebRelease2 Template Language Server',
        serverOptions,
        clientOptions
    );
    
    // Start the client (this will also launch the server)
    client.start();
    
    outputChannel.appendLine('WebRelease2 Template LSP started');
    
    // Push the disposable to the context's subscriptions
    context.subscriptions.push(client);
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
