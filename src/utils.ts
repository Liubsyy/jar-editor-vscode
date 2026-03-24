import * as vscode from 'vscode';
import * as path from 'path';

const JAR_SCHEME = 'jar-contents';
const SEPARATOR = '!/';

export const DECOMPILED_SCHEME = 'jar-decompiled';

export function createJarContentUri(jarPath: string, entryPath: string): vscode.Uri {
  const fileUri = vscode.Uri.file(jarPath);
  return vscode.Uri.from({
    scheme: JAR_SCHEME,
    authority: fileUri.authority,
    path: `${fileUri.path}${SEPARATOR}${entryPath}`,
  });
}

export function parseJarContentUri(uri: vscode.Uri): { jarPath: string; entryPath: string } {
  const idx = uri.path.indexOf(SEPARATOR);
  if (idx === -1) {
    throw new Error(`Invalid jar-contents URI: ${uri.toString()}`);
  }
  return {
    jarPath: fromJarUri(uri.authority, uri.path.substring(0, idx)),
    entryPath: uri.path.substring(idx + SEPARATOR.length),
  };
}

export function createDecompiledUri(jarPath: string, entryPath: string): vscode.Uri {
  const javaPath = entryPath.replace(/\.class$/, '.java');
  const fileUri = vscode.Uri.file(jarPath);
  return vscode.Uri.from({
    scheme: DECOMPILED_SCHEME,
    authority: fileUri.authority,
    path: `${fileUri.path}${SEPARATOR}${javaPath}`,
  });
}

export function parseDecompiledUri(uri: vscode.Uri): { jarPath: string; entryPath: string } {
  const idx = uri.path.indexOf(SEPARATOR);
  if (idx === -1) {
    throw new Error(`Invalid jar-decompiled URI: ${uri.toString()}`);
  }
  const javaPath = uri.path.substring(idx + SEPARATOR.length);
  return {
    jarPath: fromJarUri(uri.authority, uri.path.substring(0, idx)),
    entryPath: javaPath.replace(/\.java$/, '.class'),
  };
}

function fromJarUri(authority: string, jarUriPath: string): string {
  return vscode.Uri.from({
    scheme: 'file',
    authority,
    path: jarUriPath,
  }).fsPath;
}

export function getJarScheme(): string {
  return JAR_SCHEME;
}

export function getJarEditOutputRoot(jarPath: string): string {
  const parsed = path.parse(jarPath);
  return path.join(parsed.dir, `${parsed.name}_temp`, 'jar_edit_out');
}

export function getJarDependencyRoot(jarPath: string): string {
  const parsed = path.parse(jarPath);
  return path.join(parsed.dir, `${parsed.name}_temp`, 'dependency_temp');
}

export function getJarDependencyClassesRoot(jarPath: string): string {
  return path.join(getJarDependencyRoot(jarPath), 'classes');
}

export function getJarDependencyLibRoot(jarPath: string): string {
  return path.join(getJarDependencyRoot(jarPath), 'lib');
}

export function getJarTempRoot(jarPath: string): string {
  const parsed = path.parse(jarPath);
  return path.join(parsed.dir, `${parsed.name}_temp`);
}

export function getEditedJarOutputPath(jarPath: string): string {
  const parsed = path.parse(jarPath);
  return path.join(parsed.dir, `${parsed.name}_edited${parsed.ext || '.jar'}`);
}
