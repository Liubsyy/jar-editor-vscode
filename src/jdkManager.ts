import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface JdkEntry {
  name: string;
  path: string;
}

export interface JdkDropdownItem {
  label: string;
  homePath: string;
}

const STORAGE_KEY = 'jarEditor.jdkList';

export class JdkManager {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly globalState: vscode.Memento) {}

  getJdkList(): JdkEntry[] {
    return this.globalState.get<JdkEntry[]>(STORAGE_KEY, []);
  }

  /** Returns list for the dialog, with a default entry when empty. */
  getJdkListForDialog(): JdkEntry[] {
    const list = this.getJdkList();
    if (list.length > 0) {
      return list;
    }
    const defaultHome = this.detectDefaultJdkHome();
    if (defaultHome) {
      return [{ name: path.basename(defaultHome), path: defaultHome }];
    }
    return [];
  }

  getDropdownItems(): JdkDropdownItem[] {
    const items: JdkDropdownItem[] = [];
    const defaultHome = this.detectDefaultJdkHome();
    const defaultLabel = defaultHome
      ? `Default (${path.basename(defaultHome)})`
      : 'Default';
    items.push({ label: defaultLabel, homePath: '' });

    for (const entry of this.getJdkList()) {
      if (entry.path) {
        items.push({ label: entry.name || entry.path, homePath: entry.path });
      }
    }
    return items;
  }

  detectDefaultJdkHome(): string {
    const config = vscode.workspace.getConfiguration('jarEditor');
    const javaHome = config.get<string>('javaHome');
    if (javaHome) {
      const javac = path.join(javaHome, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac');
      if (fs.existsSync(javac)) {
        return javaHome;
      }
    }
    if (process.env.JAVA_HOME) {
      const javac = path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac');
      if (fs.existsSync(javac)) {
        return process.env.JAVA_HOME;
      }
    }
    return '';
  }

  async saveJdkList(list: JdkEntry[]): Promise<void> {
    await this.globalState.update(STORAGE_KEY, list);
    this._onDidChange.fire();
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
