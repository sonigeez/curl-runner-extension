import * as vscode from "vscode";

async function runCurlCommand(curlCommand?: string) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage("No active text editor!");
		return;
	}

	let finalCurlCommand = curlCommand;

	if (!finalCurlCommand) {
		const selection = editor.selection;
		finalCurlCommand = selection.isEmpty
			? editor.document.lineAt(selection.start.line).text
			: editor.document.getText(selection);
	}

	finalCurlCommand = finalCurlCommand.trim();

	const idx = finalCurlCommand.indexOf("curl");
	if (idx === -1) {
		vscode.window.showErrorMessage("No 'curl' found in the provided command.");
		return;
	}

	finalCurlCommand = finalCurlCommand.substring(idx).trim();

	const terminalName = "Curl Runner";
	let terminal = vscode.window.terminals.find((t) => t.name === terminalName);
	if (!terminal) {
		terminal = vscode.window.createTerminal(terminalName);
	}

	terminal.show(true);
	terminal.sendText(finalCurlCommand);
}

class CurlCodeLensProvider implements vscode.CodeLensProvider {
	public provideCodeLenses(
		document: vscode.TextDocument,
		token: vscode.CancellationToken,
	): vscode.CodeLens[] {
		const codeLenses: vscode.CodeLens[] = [];
		const lines = document.getText().split(/\r?\n/);

		let i = 0;
		while (i < lines.length) {
			const line = lines[i];
			const cleanedLine = this.removeCommentPrefix(line).trim();

			if (!cleanedLine.includes("curl")) {
				i++;
				continue;
			}

			const commandLines: string[] = [];
			const startLine = i;
			let isMultiLine = false;

			while (i < lines.length) {
				let current = this.removeCommentPrefix(lines[i]).trim();

				if (commandLines.length > 0 && !current) {
					break;
				}

				if (current.endsWith("\\")) {
					isMultiLine = true;
					current = current.slice(0, -1).trim();
					commandLines.push(current);
					i++;
					continue;
				}

				const nextLine = i + 1 < lines.length ? lines[i + 1] : null;
				if (
					nextLine &&
					this.isCommentLine(nextLine) &&
					(current.endsWith("{") ||
						current.endsWith(",") ||
						this.removeCommentPrefix(nextLine).trim().startsWith("-") ||
						this.isIncompleteJson(`${commandLines.join(" ")} ${current}`))
				) {
					isMultiLine = true;
					commandLines.push(current);
					i++;
					continue;
				}

				commandLines.push(current);
				i++;
				break;
			}

			const fullCommand = commandLines.join(" ").replace(/\s+/g, " ");

			const range = new vscode.Range(
				new vscode.Position(startLine, 0),
				new vscode.Position(startLine, lines[startLine].length),
			);

			codeLenses.push(
				new vscode.CodeLens(range, {
					title: "Run",
					tooltip: "Run this curl command in the integrated terminal",
					command: "curlCommentRunner.runCurl",
					arguments: [fullCommand],
				}),
			);
		}

		return codeLenses;
	}

	private isCommentLine(line: string): boolean {
		const trimmed = line.trim();
		return (
			trimmed.startsWith("//") ||
			trimmed.startsWith("#") ||
			trimmed.startsWith("/*") ||
			trimmed.startsWith("*")
		);
	}

	private isIncompleteJson(text: string): boolean {
		const openBraces = (text.match(/{/g) || []).length;
		const closeBraces = (text.match(/}/g) || []).length;
		return openBraces > closeBraces;
	}

	private removeCommentPrefix(line: string): string {
		const trimmed = line.trim();
		if (trimmed.startsWith("//")) {
			return trimmed.slice(2);
		}
		if (trimmed.startsWith("#")) {
			return trimmed.slice(1);
		}
		if (trimmed.startsWith("/*")) {
			return trimmed.slice(2);
		}
		if (trimmed.startsWith("*")) {
			return trimmed.slice(1);
		}
		return trimmed;
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log("Curl Comment Runner is now active!");

	const selector: vscode.DocumentSelector = [
		{ scheme: "file", language: "javascript" },
		{ scheme: "file", language: "python" },
		{ scheme: "file", language: "typescript" },
	];
	context.subscriptions.push(
		vscode.languages.registerCodeLensProvider(
			selector,
			new CurlCodeLensProvider(),
		),
	);

	const runCurlCmd = vscode.commands.registerCommand(
		"curlCommentRunner.runCurl",
		runCurlCommand,
	);
	context.subscriptions.push(runCurlCmd);
}

export function deactivate() {
	console.log("Curl Comment Runner is being deactivated");
}
