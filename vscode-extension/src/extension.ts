import * as vscode from 'vscode';
import { AssistantPanel } from './assistantPanel';
import { DiffManager } from './diffManager';

/**
 * Main activation entry point for the PyPilot extension.
 * Sets up commands, providers, and event listeners.
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('PyPilot extension is now active.');

	// Register command to open the Assistant panel
	context.subscriptions.push(
		vscode.commands.registerCommand('pypilot.openAssistant', () => {
			AssistantPanel.createOrShow(context.extensionUri);
		})
	);

	// Ensure decorations are updated when switching tabs or editor state changes
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor) {
				DiffManager.getInstance().refreshVisibleDecorations();
			}
		}),
		vscode.workspace.onDidOpenTextDocument(() => {
			DiffManager.getInstance().refreshVisibleDecorations();
		})
	);

	// Initial decoration refresh
	DiffManager.getInstance().refreshVisibleDecorations();
}

/**
 * Deactivation logic (cleanup if needed).
 */
export function deactivate() {
	// Cleanup logic here if necessary
}
