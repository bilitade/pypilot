import * as vscode from 'vscode';
import { DiffManager } from './diffManager';

/**
 * CodeLens provider for inline diffs.
 */
export class DiffCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        vscode.workspace.onDidChangeTextDocument(() => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    /**
     * Computes CodeLenses for the given document.
     */
    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];
        const change = DiffManager.getInstance().getChangeForFile(document.uri);

        if (change) {
            // Place CodeLens at the top of the file
            const range = new vscode.Range(0, 0, 0, 0);

            codeLenses.push(new vscode.CodeLens(range, {
                title: "$(check) Accept",
                command: "pypilot.acceptChange",
                arguments: [change.id]
            }));

            codeLenses.push(new vscode.CodeLens(range, {
                title: "$(x) Reject",
                command: "pypilot.rejectChange",
                arguments: [change.id]
            }));
        }

        return codeLenses;
    }
}
