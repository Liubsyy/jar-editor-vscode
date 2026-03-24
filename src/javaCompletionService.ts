import { JarModel } from './jarModel';

export interface JarClassInfo {
  simpleName: string;
  fullQualifiedName: string;
}

export class JavaCompletionService {
  private cache = new Map<string, JarClassInfo[]>();

  getClassNamesForJar(jarPath: string, jarModel: JarModel): JarClassInfo[] {
    const cached = this.cache.get(jarPath);
    if (cached) {
      return cached;
    }

    const archive = jarModel.getArchive(jarPath) ?? jarModel.openJar(jarPath);
    const entryPaths = archive.getAllClassEntryPaths();
    const classInfos: JarClassInfo[] = entryPaths.map((entryPath) => {
      const simpleName = entryPath.split('/').pop()!.replace(/\.class$/, '');
      const fullQualifiedName = entryPath.replace(/\//g, '.').replace(/\.class$/, '');
      return { simpleName, fullQualifiedName };
    });

    this.cache.set(jarPath, classInfos);
    return classInfos;
  }

  invalidateCache(jarPath?: string): void {
    if (jarPath) {
      this.cache.delete(jarPath);
    } else {
      this.cache.clear();
    }
  }
}
