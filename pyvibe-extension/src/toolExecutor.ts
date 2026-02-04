import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as diff from 'diff';
import { DiffManager, DiffHunk } from './diffManager';

/**
 * Standard tool call interface.
 */
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

/**
 * Standard tool result format.
 */
export interface ToolResult {
    tool_call_id: string;
    output: string;
    success: boolean;
}

/**
 * Handles execution of tool calls received from the agent.
 */
export class ToolExecutor {
    private workspaceRoot: string;

    constructor() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        this.workspaceRoot = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';
    }

    /**
     * Executes a batch of tool calls and returns results.
     */
    async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
        const results: ToolResult[] = [];

        for (const toolCall of toolCalls) {
            try {
                const args = JSON.parse(toolCall.function.arguments);
                let output: string;

                switch (toolCall.function.name) {
                    case 'read_file':
                        output = await this.readFile(args.file_path);
                        break;
                    case 'write_file':
                        output = await this.writeFile(args.file_path, args.content);
                        break;
                    case 'edit_file':
                        output = await this.editFile(args.file_path, args.old_text, args.new_text);
                        break;
                    case 'list_directory':
                        output = await this.listDirectory(args.directory_path);
                        break;
                    case 'create_directory':
                        output = await this.createDirectory(args.directory_path);
                        break;
                    case 'delete_file':
                        output = await this.deleteFile(args.file_path);
                        break;
                    case 'get_workspace_info':
                        output = await this.getWorkspaceInfo();
                        break;
                    case 'search_files':
                        output = await this.searchFiles(args.pattern);
                        break;
                    default:
                        output = `Unknown tool: ${toolCall.function.name}`;
                }

                results.push({ tool_call_id: toolCall.id, output, success: true });
            } catch (error) {
                results.push({
                    tool_call_id: toolCall.id,
                    output: `Error: ${error instanceof Error ? error.message : String(error)}`,
                    success: false
                });
            }
        }

        return results;
    }

    private async readFile(filePath: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(filePath);
        const uri = vscode.Uri.file(fullPath);

        const pending = DiffManager.getInstance().getChangeForFile(uri);
        if (pending) {
            return JSON.stringify({
                path: filePath,
                content: pending.proposedContent,
                lines: pending.proposedContent.split('\n').length,
                size: pending.proposedContent.length
            });
        }

        if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${filePath}`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        return JSON.stringify({ path: filePath, content, lines: content.split('\n').length, size: content.length });
    }

    private async writeFile(filePath: string, proposedContent: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(filePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const uri = vscode.Uri.file(fullPath);
        const pending = DiffManager.getInstance().getChangeForFile(uri);

        const originalContent = pending ? pending.originalContent : (fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '');
        const { interleavedContent, hunks } = this.calculateInterleavedDiff(originalContent, proposedContent);

        const edit = new vscode.WorkspaceEdit();
        if (fs.existsSync(fullPath)) {
            const document = await vscode.workspace.openTextDocument(uri);
            const fullRange = new vscode.Range(new vscode.Position(0, 0), document.lineAt(document.lineCount - 1).range.end);
            edit.replace(uri, fullRange, interleavedContent);
        } else {
            edit.createFile(uri, { overwrite: true, contents: Buffer.from(interleavedContent, 'utf-8') });
        }

        await vscode.workspace.applyEdit(edit);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, { preserveFocus: true, preview: false });

        await DiffManager.getInstance().proposeChange(fullPath, originalContent, proposedContent, interleavedContent, hunks);
        return `Proposed change for: ${filePath}. Review Accept/Reject in editor.`;
    }

    private async editFile(filePath: string, oldText: string, newText: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(filePath);
        if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${filePath}`);

        const uri = vscode.Uri.file(fullPath);
        const pending = DiffManager.getInstance().getChangeForFile(uri);

        const originalContent = pending ? pending.originalContent : fs.readFileSync(fullPath, 'utf-8');
        const currentIntendedContent = pending ? pending.proposedContent : originalContent;

        if (!currentIntendedContent.includes(oldText)) {
            throw new Error(`Could not find text to replace in ${filePath}. Note: The file has a pending change, you are editing the PROPOSED state.`);
        }

        const newProposedContent = currentIntendedContent.replace(oldText, newText);
        const { interleavedContent, hunks } = this.calculateInterleavedDiff(originalContent, newProposedContent);

        const edit = new vscode.WorkspaceEdit();
        const document = await vscode.workspace.openTextDocument(uri);
        const fullRange = new vscode.Range(new vscode.Position(0, 0), document.lineAt(document.lineCount - 1).range.end);
        edit.replace(uri, fullRange, interleavedContent);
        await vscode.workspace.applyEdit(edit);

        await vscode.window.showTextDocument(document, { preserveFocus: true, preview: false });
        await DiffManager.getInstance().proposeChange(fullPath, originalContent, newProposedContent, interleavedContent, hunks);

        return `Proposed edit for: ${filePath}. Review Accept/Reject in editor.`;
    }

    private calculateInterleavedDiff(oldContent: string, newContent: string): { interleavedContent: string, hunks: DiffHunk[] } {
        const oldLines = oldContent.endsWith('\n') ? oldContent : oldContent + '\n';
        const newLines = newContent.endsWith('\n') ? newContent : newContent + '\n';

        const diffResults = diff.diffLines(oldLines, newLines);
        let interleavedContent = '';
        const hunks: DiffHunk[] = [];
        let currentLine = 0;

        for (const part of diffResults) {
            const lines = part.value;
            const lineCount = part.count || 0;

            hunks.push({
                type: part.added ? 'added' : (part.removed ? 'removed' : 'equal'),
                startLine: currentLine,
                lineCount
            });
            interleavedContent += lines;
            currentLine += lineCount;
        }

        return { interleavedContent, hunks };
    }

    private async listDirectory(directoryPath: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(directoryPath);
        if (!fs.existsSync(fullPath)) throw new Error(`Directory not found: ${directoryPath}`);
        const items = fs.readdirSync(fullPath, { withFileTypes: true });
        const result = items.map(item => ({ name: item.name, type: item.isDirectory() ? 'directory' : 'file', path: path.join(directoryPath, item.name) }));
        return JSON.stringify({ directory: directoryPath, items: result });
    }

    private async createDirectory(directoryPath: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(directoryPath);
        if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
        return `Created directory: ${directoryPath}`;
    }

    private async deleteFile(filePath: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(filePath);
        if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${filePath}`);

        const uri = vscode.Uri.file(fullPath);
        const pending = DiffManager.getInstance().getChangeForFile(uri);
        const originalContent = pending ? pending.originalContent : fs.readFileSync(fullPath, 'utf-8');

        const { interleavedContent, hunks } = this.calculateInterleavedDiff(originalContent, '');

        const document = await vscode.workspace.openTextDocument(uri);
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(new vscode.Position(0, 0), document.lineAt(document.lineCount - 1).range.end);
        edit.replace(uri, fullRange, interleavedContent);
        await vscode.workspace.applyEdit(edit);

        await DiffManager.getInstance().proposeChange(fullPath, originalContent, '', interleavedContent, hunks);
        return `Proposed deletion for: ${filePath}. Review Accept/Reject in editor.`;
    }

    private async getWorkspaceInfo(): Promise<string> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const activeEditor = vscode.window.activeTextEditor;
        return JSON.stringify({
            workspace_root: this.workspaceRoot,
            workspace_name: workspaceFolders?.[0]?.name || 'Unknown',
            active_file: activeEditor?.document.fileName || null,
            open_files: vscode.workspace.textDocuments.map(doc => doc.fileName),
            language: activeEditor?.document.languageId || null
        });
    }

    private async searchFiles(pattern: string): Promise<string> {
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
        const relativePaths = files.map(file => path.relative(this.workspaceRoot, file.fsPath));
        return JSON.stringify({ pattern, files: relativePaths, count: relativePaths.length });
    }

    private resolvePathInWorkspace(filePath: string): string {
        return path.isAbsolute(filePath) ? filePath : path.join(this.workspaceRoot, filePath);
    }
}
