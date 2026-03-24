import * as vscode from 'vscode';
import * as path from 'path';
import { JarModel } from './jarModel';
import { JarScanner } from './jarScanner';
import { JarEntryItem, JarExplorerProvider, JarRootItem } from './jarExplorerProvider';
import { JarFileSystemProvider } from './jarFileSystemProvider';
import { JavaDecompiler } from './javaDecompiler';
import { DecompiledContentProvider } from './decompileContentProvider';
import { JarEditorToolProvider } from './jarEditorToolProvider';
import { JarEditService } from './jarEditService';
import { JavaCompletionService } from './javaCompletionService';
import { getJarScheme, DECOMPILED_SCHEME, createJarContentUri, parseJarContentUri } from './utils';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const jarModel = new JarModel();
  const decompiler = new JavaDecompiler(context.extensionPath);
  const explorerProvider = new JarExplorerProvider(jarModel);
  const fileSystemProvider = new JarFileSystemProvider(
    jarModel,
    path.join(context.globalStorageUri.fsPath, 'decompiled-class-cache'),
  );
  const decompiledProvider = new DecompiledContentProvider(jarModel, decompiler);
  const jarEditService = new JarEditService();
  const completionService = new JavaCompletionService();
  const scanner = new JarScanner(jarModel, () => {
    explorerProvider.refresh();
    decompiler.clearCache();
    completionService.invalidateCache();
  });

  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(getJarScheme(), fileSystemProvider),
  );

  const toolProvider = new JarEditorToolProvider(jarEditService, jarModel, completionService);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(JarEditorToolProvider.viewType, toolProvider),
  );

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(DECOMPILED_SCHEME, decompiledProvider),
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('jarEditor', explorerProvider),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jarEditor.refresh', () => scanner.scan()),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jarEditor.addEntry', async (target?: JarRootItem | JarEntryItem) => {
      if (!target || !target.isDirectory) {
        return;
      }

      const relativePath = await vscode.window.showInputBox({
        prompt: 'Enter a relative file path to add to the JAR',
        placeHolder: 'example.txt or nested/path/example.txt',
        ignoreFocusOut: true,
      });

      if (relativePath === undefined) {
        return;
      }

      const targetEntryPath = joinJarEntryPath(target.entryPath, relativePath);

      try {
        await jarEditService.addEmptyEntry(target.jarPath, targetEntryPath);
        await refreshJarState(target.jarPath, '', false);
        vscode.window.showInformationMessage(`Added empty file: ${targetEntryPath}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Add entry failed: ${message}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jarEditor.deleteEntry', async (target?: JarEntryItem) => {
      if (!target) {
        return;
      }

      const targetLabel = target.entryPath.replace(/\/$/, '');
      const confirmed = await vscode.window.showWarningMessage(
        target.isDirectory
          ? `Delete "${targetLabel}" and all its entries from the JAR?`
          : `Delete "${targetLabel}" from the JAR?`,
        { modal: true },
        'Delete',
      );

      if (confirmed !== 'Delete') {
        return;
      }

      try {
        await jarEditService.deleteEntry(target.jarPath, target.entryPath, target.isDirectory);
        await refreshJarState(target.jarPath, target.entryPath, target.isDirectory);
        vscode.window.showInformationMessage(`Deleted entry: ${targetLabel}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Delete entry failed: ${message}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.window.tabGroups.onDidChangeTabs(() => {
      void prewarmAndCloseRestoredClassTabs(jarModel, decompiler, fileSystemProvider);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jarEditor.openClass', async (jarPath: string, entryPath: string) => {
      const uri = createJarContentUri(jarPath, entryPath);
      const decompiled = await getDecompiledClassContent(uri, jarModel, decompiler, fileSystemProvider);
      if (decompiled === undefined) {
        vscode.window.showErrorMessage(`Failed to open class: ${entryPath}`);
        return;
      }
      fileSystemProvider.writeFile(uri, new TextEncoder().encode(decompiled));

      await vscode.commands.executeCommand('vscode.openWith', uri, JarEditorToolProvider.viewType);
    }),
  );

  context.subscriptions.push(scanner);

  await prewarmAndCloseRestoredClassTabs(jarModel, decompiler, fileSystemProvider);
  await scanner.initialize();

  async function refreshJarState(jarPath: string, entryPath: string, isDirectory: boolean): Promise<void> {
    await closeAffectedTabs(jarPath, entryPath, isDirectory);
    fileSystemProvider.clearJarState(jarPath);
    jarModel.closeJar(jarPath);
    decompiler.clearCache();
    await scanner.scan();
  }
}

export function deactivate(): void {}

async function prewarmAndCloseRestoredClassTabs(
  jarModel: JarModel,
  decompiler: JavaDecompiler,
  fileSystemProvider: JarFileSystemProvider,
): Promise<void> {
  const classTabs = getRestoredClassTabs();

  for (const item of classTabs) {
    const { jarPath } = parseJarContentUri(item.uri);
    if (!fileSystemProvider.canOpenJar(jarPath)) {
      await vscode.window.tabGroups.close(item.tab, true);
      continue;
    }

    if (fileSystemProvider.hasCachedClassContent(item.uri)) {
      continue;
    }

    const decompiled = await getDecompiledClassContent(item.uri, jarModel, decompiler, fileSystemProvider);
    if (decompiled !== undefined) {
      fileSystemProvider.writeFile(item.uri, new TextEncoder().encode(decompiled));
    }
  }
}

function getRestoredClassTabs(): { tab: vscode.Tab; uri: vscode.Uri }[] {
  return vscode.window.tabGroups.all
    .flatMap(group => group.tabs)
    .flatMap((tab) => {
      const input = tab.input;
      if (input instanceof vscode.TabInputCustom) {
        if (input.viewType === JarEditorToolProvider.viewType
          && input.uri.scheme === getJarScheme()
          && input.uri.path.endsWith('.class')) {
          return [{ tab, uri: input.uri }];
        }
        return [];
      }

      if (input instanceof vscode.TabInputText) {
        if (input.uri.scheme === getJarScheme() && input.uri.path.endsWith('.class')) {
          return [{ tab, uri: input.uri }];
        }
        return [];
      }

      return [];
    });
}

async function closeAffectedTabs(jarPath: string, entryPath: string, isDirectory: boolean): Promise<void> {
  const affectedTabs = vscode.window.tabGroups.all
    .flatMap(group => group.tabs)
    .filter((tab) => {
      const uri = getJarTabUri(tab);
      if (!uri || uri.scheme !== getJarScheme()) {
        return false;
      }

      try {
        const parsed = parseJarContentUri(uri);
        if (parsed.jarPath !== jarPath) {
          return false;
        }

        if (!entryPath) {
          return false;
        }

        return isEntryAffected(parsed.entryPath, entryPath, isDirectory);
      } catch {
        return false;
      }
    });

  if (affectedTabs.length > 0) {
    await vscode.window.tabGroups.close(affectedTabs, true);
  }
}

function getJarTabUri(tab: vscode.Tab): vscode.Uri | undefined {
  const input = tab.input;
  if (input instanceof vscode.TabInputCustom || input instanceof vscode.TabInputText) {
    return input.uri;
  }
  return undefined;
}

function isEntryAffected(candidateEntryPath: string, targetEntryPath: string, isDirectory: boolean): boolean {
  if (!isDirectory) {
    return candidateEntryPath === targetEntryPath;
  }

  const prefix = targetEntryPath.endsWith('/') ? targetEntryPath : `${targetEntryPath}/`;
  return candidateEntryPath === prefix || candidateEntryPath.startsWith(prefix);
}

function joinJarEntryPath(baseEntryPath: string, relativePath: string): string {
  const normalizedBase = baseEntryPath.replace(/\/$/, '');
  const normalizedRelative = relativePath.trim().replace(/\\/g, '/');
  return normalizedBase ? `${normalizedBase}/${normalizedRelative}` : normalizedRelative;
}

async function getDecompiledClassContent(
  uri: vscode.Uri,
  jarModel: JarModel,
  decompiler: JavaDecompiler,
  fileSystemProvider: JarFileSystemProvider,
): Promise<string | undefined> {
  const { jarPath, entryPath } = parseJarContentUri(uri);

  if (!fileSystemProvider.canOpenJar(jarPath)) {
    return undefined;
  }

  let archive = jarModel.getArchive(jarPath);
  if (!archive) {
    try {
      archive = jarModel.openJar(jarPath);
    } catch {
      return undefined;
    }
  }

  const classBytes = archive.readEntry(entryPath);
  if (!classBytes) {
    return undefined;
  }

  const className = entryPath.split('/').pop()!;
  const innerClasses = archive.getInnerClassEntries(entryPath);
  const cacheKey = `${jarPath}!/${entryPath}`;
  return decompiler.decompile(classBytes, cacheKey, className, innerClasses);
}
