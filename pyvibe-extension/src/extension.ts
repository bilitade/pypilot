import * as vscode from 'vscode';
import { AssistantPanel } from './assistantPanel';
import { DiffManager } from './diffManager';
import { DiffCodeLensProvider } from './diffCodeLensProvider';

/**
 * Extension entry point.
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('PyPilot extension is now active.');

	// Register Commands
	const openAssistant = vscode.commands.registerCommand('pypilot.openAssistant', () => {
		AssistantPanel.createOrShow(context.extensionUri);
	});

	const acceptChange = vscode.commands.registerCommand('pypilot.acceptChange', async (id: string) => {
		await DiffManager.getInstance().acceptChange(id);
	});

	const rejectChange = vscode.commands.registerCommand('pypilot.rejectChange', async (id: string) => {
		await DiffManager.getInstance().rejectChange(id);
	});

	// Register Providers
	const codeLensProvider = vscode.languages.registerCodeLensProvider(
		{ scheme: 'file' },
		new DiffCodeLensProvider()
	);

	// Persistence Listeners
	const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			DiffManager.getInstance().refreshVisibleDecorations();
		}
	});

	const visibleEditorsChangeDisposable = vscode.window.onDidChangeVisibleTextEditors(() => {
		DiffManager.getInstance().refreshVisibleDecorations();
	});

	context.subscriptions.push(
		openAssistant,
		acceptChange,
		rejectChange,
		codeLensProvider,
		editorChangeDisposable,
		visibleEditorsChangeDisposable
	);
}

export function deactivate() {
	// Cleanup if needed
}
