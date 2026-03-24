import AdmZip from 'adm-zip';
import * as path from 'path';

export interface JarTreeNode {
  name: string;
  fullPath: string;
  isDirectory: boolean;
  children: Map<string, JarTreeNode>;
  size: number;
}

export class JarArchive {
  private zip: AdmZip;
  private tree: JarTreeNode;
  readonly jarPath: string;

  constructor(jarPath: string) {
    this.jarPath = jarPath;
    this.zip = new AdmZip(jarPath);
    this.tree = this.buildTree();
  }

  get name(): string {
    return path.basename(this.jarPath);
  }

  getRoot(): JarTreeNode {
    return this.tree;
  }

  getNode(entryPath: string): JarTreeNode | undefined {
    if (!entryPath || entryPath === '/') {
      return this.tree;
    }

    const parts = entryPath.replace(/\/$/, '').split('/').filter(p => p.length > 0);
    let current = this.tree;
    for (const part of parts) {
      const child = current.children.get(part);
      if (!child) {
        return undefined;
      }
      current = child;
    }
    return current;
  }

  readEntry(entryPath: string): Buffer | null {
    const entry = this.zip.getEntry(entryPath);
    if (!entry) {
      return null;
    }
    return this.zip.readFile(entry);
  }

  /**
   * Collect all top-level .class entry paths (excluding inner classes containing '$').
   */
  getAllClassEntryPaths(): string[] {
    const results: string[] = [];
    this.collectClassPaths(this.tree, results);
    return results;
  }

  private collectClassPaths(node: JarTreeNode, results: string[]): void {
    if (!node.isDirectory && node.name.endsWith('.class') && !node.name.includes('$')) {
      results.push(node.fullPath);
    }
    for (const child of node.children.values()) {
      this.collectClassPaths(child, results);
    }
  }

  /**
   * Find all inner class entries for a given class file.
   * e.g. for "com/example/Foo.class", returns entries matching "com/example/Foo$*.class"
   */
  getInnerClassEntries(entryPath: string): { name: string; data: Buffer }[] {
    const prefix = entryPath.replace(/\.class$/, '') + '$';
    const results: { name: string; data: Buffer }[] = [];
    for (const entry of this.zip.getEntries()) {
      if (entry.entryName.startsWith(prefix) && entry.entryName.endsWith('.class')) {
        const data = this.zip.readFile(entry);
        if (data) {
          results.push({ name: path.basename(entry.entryName), data });
        }
      }
    }
    return results;
  }

  private buildTree(): JarTreeNode {
    const root: JarTreeNode = {
      name: '',
      fullPath: '',
      isDirectory: true,
      children: new Map(),
      size: 0,
    };

    const entries = this.zip.getEntries();
    for (const entry of entries) {
      const parts = entry.entryName.split('/').filter(p => p.length > 0);
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const isDir = entry.isDirectory ? true : !isLast;

        if (!current.children.has(part)) {
          current.children.set(part, {
            name: part,
            fullPath: parts.slice(0, i + 1).join('/') + (isDir ? '/' : ''),
            isDirectory: isDir,
            children: new Map(),
            size: isLast && !isDir ? entry.header.size : 0,
          });
        } else if (isLast && !isDir) {
          const existing = current.children.get(part)!;
          existing.size = entry.header.size;
        }

        current = current.children.get(part)!;
      }
    }

    return root;
  }
}

export class JarModel {
  private archives = new Map<string, JarArchive>();

  openJar(jarPath: string): JarArchive {
    let archive = this.archives.get(jarPath);
    if (!archive) {
      archive = new JarArchive(jarPath);
      this.archives.set(jarPath, archive);
    }
    return archive;
  }

  closeJar(jarPath: string): void {
    this.archives.delete(jarPath);
  }

  getArchive(jarPath: string): JarArchive | undefined {
    return this.archives.get(jarPath);
  }

  getAllArchives(): JarArchive[] {
    return Array.from(this.archives.values());
  }

  clear(): void {
    this.archives.clear();
  }

  has(jarPath: string): boolean {
    return this.archives.has(jarPath);
  }
}
