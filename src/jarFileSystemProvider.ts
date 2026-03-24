import * as vscode from 'vscode';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { JarArchive, JarModel } from './jarModel';
import { parseJarContentUri } from './utils';

export class JarFileSystemProvider implements vscode.FileSystemProvider {
  private _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this._onDidChangeFile.event;

  private modifiedFiles = new Map<string, Uint8Array>();

  constructor(
    private readonly jarModel: JarModel,
    private readonly classCacheRoot: string,
  ) {
    fs.mkdirSync(this.classCacheRoot, { recursive: true });
  }

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    const { jarPath, entryPath } = parseJarContentUri(uri);
    const archive = this.getOrOpenArchive(jarPath, uri);

    const node = archive.getNode(entryPath);
    if (!node) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    return {
      type: node.isDirectory ? vscode.FileType.Directory : vscode.FileType.File,
      ctime: 0,
      mtime: 0,
      size: node.size,
    };
  }

  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    const { jarPath, entryPath } = parseJarContentUri(uri);
    const archive = this.getOrOpenArchive(jarPath, uri);

    const node = archive.getNode(entryPath);
    if (!node || !node.isDirectory) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    return Array.from(node.children.values()).map(child => [
      child.name,
      child.isDirectory ? vscode.FileType.Directory : vscode.FileType.File,
    ]);
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const key = uri.toString();
    const modified = this.modifiedFiles.get(key);
    if (modified) {
      return modified;
    }

    if (uri.path.endsWith('.class')) {
      const cachedClassText = this.readCachedClassContent(uri);
      if (cachedClassText) {
        return cachedClassText;
      }
    }

    const { jarPath, entryPath } = parseJarContentUri(uri);
    const archive = this.getOrOpenArchive(jarPath, uri);

    const data = archive.readEntry(entryPath);
    if (!data) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    return new Uint8Array(data);
  }

  writeFile(uri: vscode.Uri, content: Uint8Array): void {
    const key = uri.toString();
    this.modifiedFiles.set(key, content);
    if (uri.path.endsWith('.class')) {
      const cachePath = this.getClassCachePath(uri);
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, content);
    }
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  delete(): void {
    throw vscode.FileSystemError.NoPermissions('JAR contents are read-only');
  }

  rename(): void {
    throw vscode.FileSystemError.NoPermissions('JAR contents are read-only');
  }

  createDirectory(): void {
    throw vscode.FileSystemError.NoPermissions('JAR contents are read-only');
  }

  canOpenJar(jarPath: string): boolean {
    try {
      this.getOrOpenArchive(jarPath);
      return true;
    } catch {
      return false;
    }
  }

  hasCachedClassContent(uri: vscode.Uri): boolean {
    return fs.existsSync(this.getClassCachePath(uri));
  }

  clearJarState(jarPath: string): void {
    for (const key of Array.from(this.modifiedFiles.keys())) {
      try {
        const { jarPath: keyJarPath } = parseJarContentUri(vscode.Uri.parse(key));
        if (keyJarPath === jarPath) {
          this.modifiedFiles.delete(key);
        }
      } catch {
        // Ignore malformed cache keys.
      }
    }

    fs.rmSync(this.classCacheRoot, { recursive: true, force: true });
    fs.mkdirSync(this.classCacheRoot, { recursive: true });
  }

  private getOrOpenArchive(jarPath: string, uri?: vscode.Uri): JarArchive {
    const existing = this.jarModel.getArchive(jarPath);
    if (existing) {
      return existing;
    }

    if (!fs.existsSync(jarPath)) {
      throw vscode.FileSystemError.FileNotFound(uri ?? vscode.Uri.file(jarPath));
    }

    try {
      return this.jarModel.openJar(jarPath);
    } catch {
      throw vscode.FileSystemError.Unavailable(uri ?? vscode.Uri.file(jarPath));
    }
  }

  private readCachedClassContent(uri: vscode.Uri): Uint8Array | undefined {
    const cachePath = this.getClassCachePath(uri);
    if (!fs.existsSync(cachePath)) {
      return undefined;
    }
    return new Uint8Array(fs.readFileSync(cachePath));
  }

  private getClassCachePath(uri: vscode.Uri): string {
    const hash = createHash('sha1').update(uri.toString()).digest('hex');
    return path.join(this.classCacheRoot, `${hash}.java`);
  }
}
