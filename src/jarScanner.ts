import * as vscode from 'vscode';
import { JarModel } from './jarModel';

export class JarScanner implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly jarModel: JarModel,
    private readonly onChanged: () => void,
  ) {}

  async initialize(): Promise<void> {
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*.jar');

    this.watcher.onDidCreate((uri) => {
      this.jarModel.openJar(uri.fsPath);
      this.onChanged();
    }, this, this.disposables);

    this.watcher.onDidDelete((uri) => {
      this.jarModel.closeJar(uri.fsPath);
      this.onChanged();
    }, this, this.disposables);

    this.watcher.onDidChange((uri) => {
      this.jarModel.closeJar(uri.fsPath);
      this.jarModel.openJar(uri.fsPath);
      this.onChanged();
    }, this, this.disposables);

    this.disposables.push(this.watcher);

    await this.scan();
  }

  async scan(): Promise<void> {
    this.jarModel.clear();

    const jarFiles = await vscode.workspace.findFiles('**/*.jar');
    for (const uri of jarFiles) {
      try {
        this.jarModel.openJar(uri.fsPath);
      } catch (e) {
        console.warn(`Failed to open JAR: ${uri.fsPath}`, e);
      }
    }

    this.onChanged();
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
