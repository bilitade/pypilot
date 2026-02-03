// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AssistantPanel } from './assistantPanel';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "pyvibe" is now active!');

	// Register commands
	const disposable1 = vscode.commands.registerCommand('pyvibe.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from pyvibe!');
	});

	const disposable2 = vscode.commands.registerCommand('pyvibe.openAssistant', () => {
		AssistantPanel.createOrShow(context.extensionUri);
	});

	context.subscriptions.push(disposable1, disposable2);
}


// This method is called when your extension is deactivated
export function deactivate() {}
