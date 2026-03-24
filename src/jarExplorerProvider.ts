import * as vscode from 'vscode';
import * as path from 'path';
import { JarArchive, JarModel, JarTreeNode } from './jarModel';
import { createJarContentUri } from './utils';

type TreeElement = WorkspaceFolderItem | ExplorerFolderItem | JarRootItem | JarEntryItem;

export class WorkspaceFolderItem {
  constructor(readonly workspaceFolder: vscode.WorkspaceFolder) {}
}

export class ExplorerFolderItem {
  constructor(
    readonly workspaceFolder: vscode.WorkspaceFolder,
    readonly relativePath: string,
  ) {}

  get name(): string {
    return path.basename(this.relativePath);
  }

  get absolutePath(): string {
    return path.join(this.workspaceFolder.uri.fsPath, this.relativePath);
  }
}

export class JarRootItem {
  constructor(readonly archive: JarArchive) {}

  get jarPath(): string {
    return this.archive.jarPath;
  }

  get entryPath(): string {
    return '';
  }

  get isDirectory(): boolean {
    return true;
  }
}

export class JarEntryItem {
  constructor(
    readonly archive: JarArchive,
    readonly node: JarTreeNode,
  ) {}

  get jarPath(): string {
    return this.archive.jarPath;
  }

  get entryPath(): string {
    return this.node.fullPath;
  }

  get isDirectory(): boolean {
    return this.node.isDirectory;
  }
}

export class JarExplorerProvider implements vscode.TreeDataProvider<TreeElement> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeElement | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly jarModel: JarModel) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    if (element instanceof WorkspaceFolderItem) {
      return this.createWorkspaceFolderTreeItem(element);
    }

    if (element instanceof ExplorerFolderItem) {
      return this.createExplorerFolderTreeItem(element);
    }

    if (element instanceof JarRootItem) {
      return this.createJarRootTreeItem(element.archive);
    }
    return this.createEntryTreeItem(element);
  }

  getChildren(element?: TreeElement): TreeElement[] {
    if (!element) {
      return this.getRootChildren();
    }

    if (element instanceof WorkspaceFolderItem) {
      return this.getWorkspaceLevelChildren(element.workspaceFolder);
    }

    if (element instanceof ExplorerFolderItem) {
      return this.getFolderChildren(element.workspaceFolder, element.relativePath);
    }

    if (element instanceof JarRootItem) {
      return this.getSortedChildren(element.archive, element.archive.getRoot());
    }

    if (element instanceof JarEntryItem && element.node.isDirectory) {
      return this.getSortedChildren(element.archive, element.node);
    }

    return [];
  }

  private getRootChildren(): TreeElement[] {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    if (workspaceFolders.length <= 1) {
      const singleFolder = workspaceFolders[0];
      if (!singleFolder) {
        return this.jarModel.getAllArchives()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(archive => new JarRootItem(archive));
      }
      return this.getWorkspaceLevelChildren(singleFolder);
    }

    return workspaceFolders
      .filter(workspaceFolder => this.getArchivesForWorkspaceFolder(workspaceFolder).length > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(workspaceFolder => new WorkspaceFolderItem(workspaceFolder));
  }

  private getWorkspaceLevelChildren(workspaceFolder: vscode.WorkspaceFolder): TreeElement[] {
    return this.getFolderChildren(workspaceFolder, '');
  }

  private getFolderChildren(workspaceFolder: vscode.WorkspaceFolder, relativePath: string): TreeElement[] {
    const directFolders = new Map<string, ExplorerFolderItem>();
    const directJars: JarRootItem[] = [];

    for (const archive of this.getArchivesForWorkspaceFolder(workspaceFolder)) {
      const relativeJarPath = path.relative(workspaceFolder.uri.fsPath, archive.jarPath);
      if (!relativeJarPath || relativeJarPath.startsWith('..')) {
        continue;
      }

      const remainingPath = relativePath
        ? path.relative(relativePath, relativeJarPath)
        : relativeJarPath;

      if (!remainingPath || remainingPath.startsWith('..')) {
        continue;
      }

      const segments = remainingPath.split(path.sep).filter(Boolean);
      if (segments.length === 0) {
        continue;
      }

      if (segments.length === 1) {
        directJars.push(new JarRootItem(archive));
        continue;
      }

      const childRelativePath = relativePath
        ? path.join(relativePath, segments[0])
        : segments[0];

      if (!directFolders.has(childRelativePath)) {
        directFolders.set(childRelativePath, new ExplorerFolderItem(workspaceFolder, childRelativePath));
      }
    }

    const folders = Array.from(directFolders.values())
      .sort((a, b) => a.name.localeCompare(b.name));
    directJars.sort((a, b) => a.archive.name.localeCompare(b.archive.name));
    return [...folders, ...directJars];
  }

  private getArchivesForWorkspaceFolder(workspaceFolder: vscode.WorkspaceFolder): JarArchive[] {
    return this.jarModel.getAllArchives()
      .filter(archive => vscode.workspace.getWorkspaceFolder(vscode.Uri.file(archive.jarPath))?.uri.fsPath === workspaceFolder.uri.fsPath);
  }

  private getSortedChildren(archive: JarArchive, node: JarTreeNode): JarEntryItem[] {
    const children = Array.from(node.children.values())
      .filter(child => {
        // Hide inner class files (e.g. Foo$Bar.class, Foo$1.class)
        if (!child.isDirectory && child.name.endsWith('.class') && child.name.includes('$')) {
          return false;
        }
        return true;
      });
    children.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    return children.map(child => new JarEntryItem(archive, child));
  }

  private createWorkspaceFolderTreeItem(element: WorkspaceFolderItem): vscode.TreeItem {
    const item = new vscode.TreeItem(element.workspaceFolder.name, vscode.TreeItemCollapsibleState.Collapsed);
    item.iconPath = vscode.ThemeIcon.Folder;
    item.tooltip = element.workspaceFolder.uri.fsPath;
    return item;
  }

  private createExplorerFolderTreeItem(element: ExplorerFolderItem): vscode.TreeItem {
    const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Collapsed);
    item.iconPath = vscode.ThemeIcon.Folder;
    item.tooltip = element.absolutePath;
    return item;
  }

  private createJarRootTreeItem(archive: JarArchive): vscode.TreeItem {
    const item = new vscode.TreeItem(archive.name, vscode.TreeItemCollapsibleState.Collapsed);
    item.iconPath = new vscode.ThemeIcon('file-zip');
    item.tooltip = archive.jarPath;
    item.contextValue = 'jarRoot';
    return item;
  }

  private createEntryTreeItem(element: JarEntryItem): vscode.TreeItem {
    const { archive, node } = element;

    if (node.isDirectory) {
      const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = vscode.ThemeIcon.Folder;
      item.contextValue = 'jarDirectory';
      return item;
    }

    const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.None);
    item.iconPath = vscode.ThemeIcon.File;
    item.resourceUri = createJarContentUri(archive.jarPath, node.fullPath);
    item.contextValue = 'jarFile';

    if (node.name.endsWith('.class')) {
      item.command = {
        command: 'jarEditor.openClass',
        title: 'Decompile & Open',
        arguments: [archive.jarPath, node.fullPath],
      };
    } else {
      const openUri = createJarContentUri(archive.jarPath, node.fullPath);
      item.command = {
        command: 'vscode.openWith',
        title: 'Open File',
        arguments: [openUri, 'jarEditor.textEditor'],
      };
    }

    return item;
  }
}
