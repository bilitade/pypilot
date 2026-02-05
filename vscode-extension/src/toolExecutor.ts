import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DiffManager } from './diffManager';

/**
 * Represents a tool call request from the AI agent.
 */
export interface ToolCall {
    id: string;
    type: string;
    function: {
        name: string;
        arguments: string;
    };
}

/**
 * Represents the result of a tool execution.
 */
export interface ToolResult {
    tool_call_id: string;
    output: string;
}

/**
 * Executes file system and workspace operations requested by the AI.
 */
export class ToolExecutor {
    private workspaceRoot: string;

    constructor() {
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
    }

    /**
     * Dispatches multiple tool calls to their respective handlers.
     */
    public async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
        const results: ToolResult[] = [];
        for (const toolCall of toolCalls) {
            let output = '';
            try {
                const args = JSON.parse(toolCall.function.arguments);
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
                    case 'delete_file':
                        output = await this.deleteFile(args.file_path);
                        break;
                    case 'list_directory':
                        output = await this.listDirectory(args.directory_path || '.');
                        break;
                    case 'create_directory':
                        output = await this.createDirectory(args.directory_path);
                        break;
                    case 'get_workspace_info':
                        output = await this.getWorkspaceInfo();
                        break;
                    case 'search_files':
                        output = await this.searchFiles(args.pattern || args.query);
                        break;
                    default:
                        output = `Unknown tool: ${toolCall.function.name}`;
                }
            } catch (error) {
                output = `Error: ${error instanceof Error ? error.message : String(error)}`;
            }
            results.push({ tool_call_id: toolCall.id, output });
        }
        return results;
    }

    private async readFile(filePath: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(filePath);
        if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${filePath}`);
        return fs.readFileSync(fullPath, 'utf-8');
    }

    /**
     * Writes content to a file. Proposes a change if the file exists, 
     * otherwise creates it immediately.
     */
    private async writeFile(filePath: string, proposedContent: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(filePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const uri = vscode.Uri.file(fullPath);
        const pending = DiffManager.getInstance().getChangeForFile(uri);
        const originalContent = pending ? pending.originalContent : (fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '');
        const edit = new vscode.WorkspaceEdit();

        if (fs.existsSync(fullPath)) {
            const document = await vscode.workspace.openTextDocument(uri);
            const fullRange = new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));
            edit.replace(uri, fullRange, proposedContent);
            await vscode.workspace.applyEdit(edit);

            const proposalId = await DiffManager.getInstance().proposeChange(fullPath, originalContent, proposedContent);
            return JSON.stringify({ action: 'proposal', type: 'write', filePath, proposalId });
        } else {
            edit.createFile(uri, { overwrite: true, contents: Buffer.from(proposedContent, 'utf-8') });
            await vscode.workspace.applyEdit(edit);
            return `Created new file: ${filePath}`;
        }
    }

    /**
     * Performs a find-and-replace edit on an existing file.
     */
    private async editFile(filePath: string, oldText: string, newText: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(filePath);
        if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${filePath}`);

        const uri = vscode.Uri.file(fullPath);
        const pending = DiffManager.getInstance().getChangeForFile(uri);

        const originalContent = pending ? pending.originalContent : fs.readFileSync(fullPath, 'utf-8');
        const currentContent = pending ? pending.proposedContent : originalContent;

        if (!currentContent.includes(oldText)) {
            throw new Error(`Could not find text to replace in ${filePath}. Note: The file has a pending change, ensure you are editing the latest state.`);
        }

        const updatedContent = currentContent.replace(oldText, newText);
        const edit = new vscode.WorkspaceEdit();
        const document = await vscode.workspace.openTextDocument(uri);
        const fullRange = new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));

        edit.replace(uri, fullRange, updatedContent);
        await vscode.workspace.applyEdit(edit);

        const proposalId = await DiffManager.getInstance().proposeChange(fullPath, originalContent, updatedContent);
        return JSON.stringify({ action: 'proposal', type: 'edit', filePath, proposalId });
    }

    private async listDirectory(directoryPath: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(directoryPath);
        if (!fs.existsSync(fullPath)) throw new Error(`Directory not found: ${directoryPath}`);
        const items = fs.readdirSync(fullPath, { withFileTypes: true });
        const result = items.map(item => ({
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            path: path.join(directoryPath, item.name)
        }));
        return JSON.stringify({ directory: directoryPath, items: result });
    }

    private async createDirectory(directoryPath: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(directoryPath);
        if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
        return `Created directory: ${directoryPath}`;
    }

    /**
     * Proposes the deletion of a file by clearing its content and marking it for review.
     */
    private async deleteFile(filePath: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(filePath);
        if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${filePath}`);

        const uri = vscode.Uri.file(fullPath);
        const pending = DiffManager.getInstance().getChangeForFile(uri);
        const originalContent = pending ? pending.originalContent : fs.readFileSync(fullPath, 'utf-8');

        const document = await vscode.workspace.openTextDocument(uri);
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));

        edit.replace(uri, fullRange, '');
        await vscode.workspace.applyEdit(edit);

        const proposalId = await DiffManager.getInstance().proposeChange(fullPath, originalContent, '');
        return JSON.stringify({ action: 'proposal', type: 'delete', filePath, proposalId });
    }

    /**
     * Returns metadata about the current workspace state.
     */
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

    /**
     * Searches for files matching a glob pattern.
     */
    private async searchFiles(pattern: string): Promise<string> {
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
        const relativePaths = files.map(file => path.relative(this.workspaceRoot, file.fsPath));
        return JSON.stringify({ pattern, files: relativePaths, count: relativePaths.length });
    }

    private resolvePathInWorkspace(filePath: string): string {
        return path.isAbsolute(filePath) ? filePath : path.join(this.workspaceRoot, filePath);
    }
}
