import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tool call interface matching backend format
 */
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

export interface ToolResult {
    tool_call_id: string;
    output: string;
    success: boolean;
}

/**
 * Handles execution of tool calls from the backend agent
 */
export class ToolExecutor {
    private workspaceRoot: string;

    constructor() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        this.workspaceRoot = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';
    }

    /**
     * Execute a batch of tool calls
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

                results.push({
                    tool_call_id: toolCall.id,
                    output: output,
                    success: true
                });
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

    /**
     * Read a file from the workspace
     */
    private async readFile(filePath: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(filePath);
        
        if (!fs.existsSync(fullPath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        
        return JSON.stringify({
            path: filePath,
            content: content,
            lines: lines.length,
            size: content.length
        });
    }

    /**
     * Write content to a file (create or overwrite)
     */
    private async writeFile(filePath: string, content: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(filePath);
        const dir = path.dirname(fullPath);

        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Check if file exists for approval
        const fileExists = fs.existsSync(fullPath);
        const action = fileExists ? 'overwrite' : 'create';

        // Ask for user confirmation
        const confirmation = await vscode.window.showInformationMessage(
            `The agent wants to ${action} file: ${filePath}`,
            { modal: true },
            'Approve',
            'Reject'
        );

        if (confirmation !== 'Approve') {
            throw new Error('User rejected file write operation');
        }

        fs.writeFileSync(fullPath, content, 'utf-8');

        // Open the file in the editor
        const document = await vscode.workspace.openTextDocument(fullPath);
        await vscode.window.showTextDocument(document);

        return `Successfully ${action}d file: ${filePath} (${content.length} bytes)`;
    }

    /**
     * Edit a file by replacing old_text with new_text
     */
    private async editFile(filePath: string, oldText: string, newText: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(filePath);

        if (!fs.existsSync(fullPath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const content = fs.readFileSync(fullPath, 'utf-8');

        // Check if old_text exists
        if (!content.includes(oldText)) {
            throw new Error(`Could not find the text to replace in ${filePath}`);
        }

        const newContent = content.replace(oldText, newText);

        // Show diff to user for approval
        const approval = await this.showDiffAndAskApproval(filePath, content, newContent);

        if (!approval) {
            throw new Error('User rejected the edit');
        }

        fs.writeFileSync(fullPath, newContent, 'utf-8');

        // Refresh the file in editor if open
        const document = await vscode.workspace.openTextDocument(fullPath);
        await vscode.window.showTextDocument(document);

        return `Successfully edited file: ${filePath}`;
    }

    /**
     * Show a diff preview and ask for approval
     */
    private async showDiffAndAskApproval(filePath: string, oldContent: string, newContent: string): Promise<boolean> {
        // Create temporary files for diff
        const tempDir = path.join(this.workspaceRoot, '.vscode', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const oldFile = path.join(tempDir, `old_${path.basename(filePath)}`);
        const newFile = path.join(tempDir, `new_${path.basename(filePath)}`);

        fs.writeFileSync(oldFile, oldContent);
        fs.writeFileSync(newFile, newContent);

        const oldUri = vscode.Uri.file(oldFile);
        const newUri = vscode.Uri.file(newFile);

        // Show diff
        await vscode.commands.executeCommand('vscode.diff', oldUri, newUri, `Proposed Edit: ${path.basename(filePath)}`);

        // Ask for approval
        const result = await vscode.window.showInformationMessage(
            `Apply this edit to ${filePath}?`,
            { modal: true },
            'Apply',
            'Reject'
        );

        // Cleanup temp files
        fs.unlinkSync(oldFile);
        fs.unlinkSync(newFile);

        return result === 'Apply';
    }

    /**
     * List files in a directory
     */
    private async listDirectory(directoryPath: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(directoryPath);

        if (!fs.existsSync(fullPath)) {
            throw new Error(`Directory not found: ${directoryPath}`);
        }

        const items = fs.readdirSync(fullPath, { withFileTypes: true });
        const result = items.map(item => ({
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            path: path.join(directoryPath, item.name)
        }));

        return JSON.stringify({ directory: directoryPath, items: result });
    }

    /**
     * Create a directory
     */
    private async createDirectory(directoryPath: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(directoryPath);

        if (fs.existsSync(fullPath)) {
            return `Directory already exists: ${directoryPath}`;
        }

        fs.mkdirSync(fullPath, { recursive: true });
        return `Successfully created directory: ${directoryPath}`;
    }

    /**
     * Delete a file
     */
    private async deleteFile(filePath: string): Promise<string> {
        const fullPath = this.resolvePathInWorkspace(filePath);

        if (!fs.existsSync(fullPath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        // Ask for confirmation
        const confirmation = await vscode.window.showWarningMessage(
            `The agent wants to delete: ${filePath}`,
            { modal: true },
            'Delete',
            'Cancel'
        );

        if (confirmation !== 'Delete') {
            throw new Error('User cancelled file deletion');
        }

        fs.unlinkSync(fullPath);
        return `Successfully deleted file: ${filePath}`;
    }

    /**
     * Get workspace information
     */
    private async getWorkspaceInfo(): Promise<string> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const activeEditor = vscode.window.activeTextEditor;

        const info = {
            workspace_root: this.workspaceRoot,
            workspace_name: workspaceFolders?.[0]?.name || 'Unknown',
            active_file: activeEditor?.document.fileName || null,
            open_files: vscode.workspace.textDocuments.map(doc => doc.fileName),
            language: activeEditor?.document.languageId || null
        };

        return JSON.stringify(info);
    }

    /**
     * Search for files matching a pattern
     */
    private async searchFiles(pattern: string): Promise<string> {
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
        const relativePaths = files.map(file => 
            path.relative(this.workspaceRoot, file.fsPath)
        );

        return JSON.stringify({ pattern, files: relativePaths, count: relativePaths.length });
    }

    /**
     * Resolve a path relative to workspace root
     */
    private resolvePathInWorkspace(filePath: string): string {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }
        return path.join(this.workspaceRoot, filePath);
    }
}


