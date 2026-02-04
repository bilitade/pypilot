import * as vscode from 'vscode';

/**
 * Metadata for a single hunk (added, removed, or equal) in an interleaved diff document.
 */
export interface DiffHunk {
    lineCount: number;
    startLine: number;
    type: 'added' | 'removed' | 'equal';
}

/**
 * Represents a pending AI-suggested change for a file.
 */
export interface PendingChange {
    id: string;
    filePath: string;
    originalContent: string;
    proposedContent: string;
    interleavedContent: string;
    hunks: DiffHunk[];
}

/**
 * Manages inline diff decorations and pending AI changes.
 */
export class DiffManager {
    private static instance: DiffManager;
    private pendingChanges: Map<string, PendingChange> = new Map();

    private addedDecoration: vscode.TextEditorDecorationType;
    private removedDecoration: vscode.TextEditorDecorationType;

    private constructor() {
        this.addedDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('diffEditor.insertedLineBackground'),
            isWholeLine: true,
            overviewRulerColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
            overviewRulerLane: vscode.OverviewRulerLane.Full
        });

        this.removedDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('diffEditor.removedLineBackground'),
            isWholeLine: true,
            overviewRulerColor: new vscode.ThemeColor('diffEditor.removedTextBackground'),
            overviewRulerLane: vscode.OverviewRulerLane.Full,
            opacity: '0.8'
        });
    }

    public static getInstance(): DiffManager {
        if (!DiffManager.instance) {
            DiffManager.instance = new DiffManager();
        }
        return DiffManager.instance;
    }

    /**
     * Proposes a new change for a file, overlaying decorations on the interleaved content.
     */
    public async proposeChange(filePath: string, originalContent: string, proposedContent: string, interleavedContent: string, hunks: DiffHunk[]): Promise<string> {
        const id = `change_${Date.now()}`;
        const pathKey = vscode.Uri.file(filePath).toString();

        const change: PendingChange = { id, filePath, originalContent, proposedContent, interleavedContent, hunks };
        this.pendingChanges.set(pathKey, change);

        await this.updateDecorations(filePath);
        return id;
    }

    /**
     * Permanently applies the proposed change.
     */
    public async acceptChange(id: string) {
        const change = this.getChangeById(id);
        if (!change) return;

        const uri = vscode.Uri.file(change.filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        const edit = new vscode.WorkspaceEdit();

        const fullRange = new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));
        edit.replace(uri, fullRange, change.proposedContent);

        await vscode.workspace.applyEdit(edit);
        await document.save();

        this.removeChange(id);
    }

    /**
     * Discards the proposed change and reverts the document.
     */
    public async rejectChange(id: string) {
        const change = this.getChangeById(id);
        if (!change) return;

        const uri = vscode.Uri.file(change.filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        const edit = new vscode.WorkspaceEdit();

        const fullRange = new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));
        edit.replace(uri, fullRange, change.originalContent);

        await vscode.workspace.applyEdit(edit);
        await document.save();

        this.removeChange(id);
    }

    private removeChange(id: string) {
        for (const [pathKey, change] of this.pendingChanges.entries()) {
            if (change.id === id) {
                const filePath = change.filePath;
                this.pendingChanges.delete(pathKey);
                this.updateDecorations(filePath);
                break;
            }
        }
    }

    private getChangeById(id: string): PendingChange | undefined {
        for (const change of this.pendingChanges.values()) {
            if (change.id === id) return change;
        }
        return undefined;
    }

    public getChangeForFile(uri: vscode.Uri): PendingChange | undefined {
        return this.pendingChanges.get(uri.toString());
    }

    /**
     * Refreshes decorations for all visible editors.
     */
    public async refreshVisibleDecorations() {
        for (const editor of vscode.window.visibleTextEditors) {
            await this.updateDecorations(editor.document.uri.fsPath, editor);
        }
    }

    private async updateDecorations(filePath: string, specificEditor?: vscode.TextEditor) {
        const uri = vscode.Uri.file(filePath);
        const editors = specificEditor ? [specificEditor] : vscode.window.visibleTextEditors.filter(e => e.document.uri.toString() === uri.toString());
        const change = this.getChangeForFile(uri);

        for (const editor of editors) {
            if (!change) {
                editor.setDecorations(this.addedDecoration, []);
                editor.setDecorations(this.removedDecoration, []);
                continue;
            }

            const addedRanges: vscode.Range[] = [];
            const removedRanges: vscode.Range[] = [];

            for (const hunk of change.hunks) {
                const range = new vscode.Range(
                    hunk.startLine, 0,
                    hunk.startLine + hunk.lineCount - 1, 0
                );

                if (hunk.type === 'added') {
                    addedRanges.push(range);
                } else if (hunk.type === 'removed') {
                    removedRanges.push(range);
                }
            }

            editor.setDecorations(this.addedDecoration, addedRanges);
            editor.setDecorations(this.removedDecoration, removedRanges);
        }
    }
}
