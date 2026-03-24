import * as vscode from 'vscode';
import { JarModel } from './jarModel';
import { JavaDecompiler } from './javaDecompiler';
import { parseDecompiledUri } from './utils';

export class DecompiledContentProvider implements vscode.TextDocumentContentProvider {
  constructor(
    private readonly jarModel: JarModel,
    private readonly decompiler: JavaDecompiler,
  ) {}

  async provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> {
    const { jarPath, entryPath } = parseDecompiledUri(uri);
    const cacheKey = `${jarPath}!/${entryPath}`;

    const archive = this.jarModel.getArchive(jarPath);
    if (!archive) {
      return `// JAR file not found: ${jarPath}`;
    }

    const classBytes = archive.readEntry(entryPath);
    if (!classBytes) {
      return `// Entry not found: ${entryPath}`;
    }

    const className = entryPath.split('/').pop()!;
    const innerClasses = archive.getInnerClassEntries(entryPath);

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: `Decompiling ${className}...`,
      },
      () => this.decompiler.decompile(classBytes, cacheKey, className, innerClasses),
    );
  }
}
