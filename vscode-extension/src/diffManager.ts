import * as vscode from 'vscode';
import * as diff from 'diff';

/**
 * Metadata for a pending AI-suggested change.
 */
export interface PendingChange {
    /** Unique identifier for the proposal. */
    id: string;
    /** Absolute path to the file. */
    filePath: string;
    /** File content before the AI's proposal. */
    originalContent: string;
    /** File content after the AI's proposal. */
    proposedContent: string;
}

/**
 * Manages visualization of AI-proposed changes using VS Code decorations.
 * Implemented as a singleton to maintain consistent state across the extension.
 */
export class DiffManager {
    private static instance: DiffManager;
    private pendingChanges: Map<string, PendingChange> = new Map();

    private addedDecoration: vscode.TextEditorDecorationType;
    private removedDecoration: vscode.TextEditorDecorationType;

    private constructor() {
        // Decoration for added lines (background highlight)
        this.addedDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('diffEditor.insertedLineBackground'),
            isWholeLine: true,
            overviewRulerColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
            overviewRulerLane: vscode.OverviewRulerLane.Full
        });

        // Decoration for removed lines (ghost text via 'before' pseudo-element)
        this.removedDecoration = vscode.window.createTextEditorDecorationType({
            isWholeLine: false
        });
    }

    public static getInstance(): DiffManager {
        if (!DiffManager.instance) {
            DiffManager.instance = new DiffManager();
        }
        return DiffManager.instance;
    }

    /**
     * Registers a new change proposal and triggers UI refresh.
     * @param filePath Absolute path of the file being changed.
     * @param originalContent Content of the file before modification.
     * @param proposedContent Content of the file after modification.
     * @returns A promise resolving to the unique proposal ID.
     */
    public async proposeChange(filePath: string, originalContent: string, proposedContent: string): Promise<string> {
        const id = `change_${Date.now()}`;
        const pathKey = vscode.Uri.file(filePath).toString();

        const change: PendingChange = { id, filePath, originalContent, proposedContent };
        this.pendingChanges.set(pathKey, change);

        await this.updateDecorations(filePath);
        return id;
    }

    /**
     * Finalizes the change by saving the proposed content to disk.
     * @param id The ID of the proposal to accept.
     */
    public async acceptChange(id: string) {
        const change = this.getChangeById(id);
        if (!change) return;

        const uri = vscode.Uri.file(change.filePath);
        if (change.proposedContent === '') {
            try {
                // Handle file deletion
                await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: true });
            } catch (e) {
                // File might have already been deleted
            }
        } else {
            const document = await vscode.workspace.openTextDocument(uri);
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));
            edit.replace(uri, fullRange, change.proposedContent);
            await vscode.workspace.applyEdit(edit);
            await document.save();
        }

        this.removeChange(id);
    }

    /**
     * Reverts the file to its original state.
     * @param id The ID of the proposal to reject.
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

    /**
     * Removes a change proposal from the internal map and clears decorations.
     */
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

    /**
     * Retrieves the pending change for a given file URI.
     */
    public getChangeForFile(uri: vscode.Uri): PendingChange | undefined {
        return this.pendingChanges.get(uri.toString());
    }

    /**
     * Refreshes decorations for all currently visible text editors.
     */
    public async refreshVisibleDecorations() {
        for (const editor of vscode.window.visibleTextEditors) {
            await this.updateDecorations(editor.document.uri.fsPath, editor);
        }
    }

    /**
     * Calculates diff and applies decorations to the specified file's editors.
     */
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
            const removedOptions: vscode.DecorationOptions[] = [];

            // Perform line-by-line diff
            const diffResults = diff.diffLines(change.originalContent, change.proposedContent);
            let currentLine = 0;

            for (const part of diffResults) {
                const lineCount = part.count || 0;
                if (part.added) {
                    addedRanges.push(new vscode.Range(currentLine, 0, currentLine + lineCount - 1, 0));
                    currentLine += lineCount;
                } else if (part.removed) {
                    // Render removals as ghost text
                    const attachLine = Math.min(currentLine, editor.document.lineCount - 1);
                    const deletedLines = part.value.replace(/\n$/, '').split('\n');

                    for (let i = 0; i < deletedLines.length; i++) {
                        removedOptions.push({
                            range: new vscode.Range(attachLine, 0, attachLine, 0),
                            renderOptions: {
                                before: {
                                    contentText: '  - ' + deletedLines[i],
                                    color: new vscode.ThemeColor('diffEditor.removedTextForeground'),
                                    backgroundColor: new vscode.ThemeColor('diffEditor.removedLineBackground'),
                                    fontStyle: 'italic',
                                    margin: `0 0 -1.2em 0; display: block;`
                                }
                            }
                        });
                    }
                } else {
                    currentLine += lineCount;
                }
            }

            editor.setDecorations(this.addedDecoration, addedRanges);
            editor.setDecorations(this.removedDecoration, removedOptions);
        }
    }
}
