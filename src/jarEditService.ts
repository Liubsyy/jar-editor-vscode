import AdmZip from 'adm-zip';
import { execFile, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { findJavaToolExecutable } from './javaDecompiler';
import {
  getEditedJarOutputPath,
  getJarDependencyClassesRoot,
  getJarDependencyLibRoot,
  getJarDependencyRoot,
  getJarEditOutputRoot,
  getJarTempRoot,
} from './utils';

export interface SaveEntryResult {
  outputPath: string;
  generatedEntries: string[];
}

export interface JavaTargetOption {
  value: string;
  label: string;
}

interface CompileContext {
  classpathEntries: string[];
  generatedEntriesRoot: string;
  outputPath: string;
}

const SPRING_BOOT_CLASSES_PREFIX = 'BOOT-INF/classes/';
const SPRING_BOOT_LIB_PREFIX = 'BOOT-INF/lib/';

export class JarEditService {
  private targetOptionsCache = new Map<string, JavaTargetOption[]>();

  async saveEntry(jarPath: string, entryPath: string, text: string, target?: string, extraClasspathJars?: string[], jdkHome?: string): Promise<SaveEntryResult> {
    if (entryPath.endsWith('.class')) {
      return this.saveClassEntry(jarPath, entryPath, text, target ?? this.getDefaultJavaTarget(), extraClasspathJars ?? [], jdkHome);
    }
    return this.saveTextEntry(jarPath, entryPath, text);
  }

  getJavaTargetOptions(jdkHome?: string): JavaTargetOption[] {
    const cacheKey = jdkHome || '';
    const cached = this.targetOptionsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const maxFeatureVersion = this.detectJavacFeatureVersion(jdkHome);
    const effectiveMax = maxFeatureVersion && maxFeatureVersion >= 8 ? maxFeatureVersion : 8;
    const options: JavaTargetOption[] = [];

    for (let version = 1; version <= 8; version++) {
      options.push({
        value: `1.${version}`,
        label: `Java 1.${version}`,
      });
    }

    for (let version = 9; version <= effectiveMax; version++) {
      options.push({
        value: String(version),
        label: `Java ${version}`,
      });
    }

    this.targetOptionsCache.set(cacheKey, options);
    return options;
  }

  getDefaultJavaTarget(jdkHome?: string): string {
    const options = this.getJavaTargetOptions(jdkHome);
    return options[options.length - 1].value;
  }

  getDefaultJavaTargetForClassEntry(jarPath: string, entryPath: string, jdkHome?: string): string {
    const classFeatureVersion = this.getClassFeatureVersion(jarPath, entryPath);
    if (!classFeatureVersion) {
      return this.getDefaultJavaTarget(jdkHome);
    }

    const target = this.mapFeatureVersionToJavaTarget(classFeatureVersion);
    const options = this.getJavaTargetOptions(jdkHome);
    const matchingOption = options.find((option) => option.value === target);
    return matchingOption ? matchingOption.value : this.getDefaultJavaTarget(jdkHome);
  }

  async buildJar(jarPath: string): Promise<string> {
    const outputJarPath = getEditedJarOutputPath(jarPath);
    const editOutputRoot = getJarEditOutputRoot(jarPath);
    const tempRoot = getJarTempRoot(jarPath);
    const zip = new AdmZip(jarPath);

    if (!fs.existsSync(editOutputRoot)) {
      throw new Error('Nothing modified');
    }

    const files = await this.collectFiles(editOutputRoot);
    if (files.length === 0) {
      throw new Error('Nothing modified');
    }

    for (const filePath of files) {
      const relativePath = path.relative(editOutputRoot, filePath).split(path.sep).join('/');
      const content = await fs.promises.readFile(filePath);
      const existingEntry = zip.getEntry(relativePath);
      if (existingEntry) {
        zip.updateFile(existingEntry, content);
      } else {
        zip.addFile(relativePath, content);
      }
    }

    await this.writeZip(zip, outputJarPath);
    await fs.promises.copyFile(outputJarPath, jarPath);
    await fs.promises.rm(outputJarPath, { force: true });
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
    return jarPath;
  }

  async addEmptyEntry(jarPath: string, targetEntryPath: string): Promise<string> {
    const normalizedEntryPath = this.normalizeJarEntryPath(targetEntryPath);
    const outputJarPath = getEditedJarOutputPath(jarPath);
    const zip = new AdmZip(jarPath);

    if (zip.getEntry(normalizedEntryPath)) {
      throw new Error(`Entry already exists: ${normalizedEntryPath}`);
    }

    zip.addFile(normalizedEntryPath, Buffer.alloc(0));
    await this.commitZipUpdate(zip, jarPath, outputJarPath);
    return normalizedEntryPath;
  }

  async addEmptyDirectory(jarPath: string, targetEntryPath: string): Promise<string> {
    const normalizedEntryPath = this.ensureDirectoryEntryPath(this.normalizeJarEntryPath(targetEntryPath));
    const outputJarPath = getEditedJarOutputPath(jarPath);
    const zip = new AdmZip(jarPath);

    if (zip.getEntry(normalizedEntryPath)) {
      throw new Error(`Entry already exists: ${normalizedEntryPath}`);
    }

    zip.addFile(normalizedEntryPath, Buffer.alloc(0));
    await this.commitZipUpdate(zip, jarPath, outputJarPath);
    return normalizedEntryPath;
  }

  async deleteEntry(jarPath: string, targetEntryPath: string, isDirectory: boolean): Promise<void> {
    const normalizedEntryPath = this.normalizeJarEntryPath(targetEntryPath);
    const deletePrefix = isDirectory ? this.ensureDirectoryEntryPath(normalizedEntryPath) : normalizedEntryPath;
    const zip = new AdmZip(jarPath);
    const outputJarPath = getEditedJarOutputPath(jarPath);
    const matchingEntries = zip.getEntries().filter((entry) => (
      isDirectory
        ? entry.entryName === deletePrefix || entry.entryName.startsWith(deletePrefix)
        : entry.entryName === deletePrefix
    ));

    if (matchingEntries.length === 0) {
      throw new Error(`Entry not found: ${normalizedEntryPath}`);
    }

    for (const entry of matchingEntries) {
      zip.deleteFile(entry.entryName);
    }

    await this.commitZipUpdate(zip, jarPath, outputJarPath);
  }

  private async saveTextEntry(jarPath: string, entryPath: string, text: string): Promise<SaveEntryResult> {
    const outputRoot = getJarEditOutputRoot(jarPath);
    const outputPath = path.join(outputRoot, ...entryPath.split('/'));
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.writeFile(outputPath, text, 'utf8');
    return {
      outputPath,
      generatedEntries: [entryPath],
    };
  }

  private async saveClassEntry(jarPath: string, entryPath: string, text: string, target: string, extraClasspathJars: string[], jdkHome?: string): Promise<SaveEntryResult> {
    const outputRoot = getJarEditOutputRoot(jarPath);
    const compileRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'jar-editor-compile-'));
    const sourceRoot = path.join(compileRoot, 'src');
    const classesRoot = path.join(compileRoot, 'classes');
    const sourceRelativePath = this.getJavaSourceRelativePath(entryPath, text);
    const sourcePath = path.join(sourceRoot, ...sourceRelativePath.split('/'));

    try {
      const compileContext = await this.createCompileContext(jarPath, entryPath, outputRoot, extraClasspathJars);
      await fs.promises.mkdir(path.dirname(sourcePath), { recursive: true });
      await fs.promises.mkdir(classesRoot, { recursive: true });
      await fs.promises.writeFile(sourcePath, text, 'utf8');

      await this.compileJavaSource(compileContext.classpathEntries, classesRoot, sourcePath, target, jdkHome);

      const compiledFiles = await this.collectFiles(classesRoot);
      if (compiledFiles.length === 0) {
        throw new Error('Compilation succeeded but produced no class files.');
      }

      await fs.promises.mkdir(outputRoot, { recursive: true });
      await this.removePreviousCompiledArtifacts(outputRoot, entryPath);

      const generatedEntries: string[] = [];
      for (const compiledFile of compiledFiles) {
        const relativePath = path.relative(classesRoot, compiledFile).split(path.sep).join('/');
        const generatedEntry = path.posix.join(compileContext.generatedEntriesRoot, relativePath);
        const destinationPath = path.join(outputRoot, ...generatedEntry.split('/'));
        await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
        await fs.promises.copyFile(compiledFile, destinationPath);
        generatedEntries.push(generatedEntry);
      }

      return {
        outputPath: compileContext.outputPath,
        generatedEntries,
      };
    } finally {
      await fs.promises.rm(compileRoot, { recursive: true, force: true });
    }
  }

  private async createCompileContext(jarPath: string, entryPath: string, outputRoot: string, extraClasspathJars: string[]): Promise<CompileContext> {
    // Filter out the current JAR from extra classpath to avoid duplicates
    const extraJars = this.compactJarClasspathEntries(extraClasspathJars.filter((p) => p !== jarPath));

    if (!this.isSpringBootClassesEntry(entryPath)) {
      const classpathEntries = [
        ...(fs.existsSync(outputRoot) ? [outputRoot] : []),
        jarPath,
        ...extraJars,
      ];
      return {
        classpathEntries,
        generatedEntriesRoot: '',
        outputPath: outputRoot,
      };
    }

    const dependencyRoot = getJarDependencyRoot(jarPath);
    const dependencyClassesRoot = getJarDependencyClassesRoot(jarPath);
    const dependencyLibRoot = getJarDependencyLibRoot(jarPath);
    const editedClassesRoot = path.join(outputRoot, ...SPRING_BOOT_CLASSES_PREFIX.replace(/\/$/, '').split('/'));

    await fs.promises.rm(dependencyRoot, { recursive: true, force: true });
    await fs.promises.mkdir(dependencyClassesRoot, { recursive: true });
    await fs.promises.mkdir(dependencyLibRoot, { recursive: true });
    await this.prepareSpringBootDependencies(jarPath, dependencyClassesRoot, dependencyLibRoot);
    const dependencyLibEntries = await this.getCompactDependencyClasspathEntries(dependencyLibRoot);

    const classpathEntries = [
      ...(fs.existsSync(editedClassesRoot) ? [editedClassesRoot] : []),
      dependencyClassesRoot,
      ...dependencyLibEntries,
      jarPath,
      ...extraJars,
    ];

    return {
      classpathEntries,
      generatedEntriesRoot: SPRING_BOOT_CLASSES_PREFIX.replace(/\/$/, ''),
      outputPath: editedClassesRoot,
    };
  }

  private async compileJavaSource(
    classpathEntries: string[],
    classesRoot: string,
    sourcePath: string,
    target: string,
    jdkHome?: string,
  ): Promise<void> {
    const javacPath = jdkHome
      ? path.join(jdkHome, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac')
      : findJavaToolExecutable('javac');
    const classpath = classpathEntries.join(path.delimiter);
    const compileArgs = this.getCompileArgs(classesRoot, sourcePath, target);

    await new Promise<void>((resolve, reject) => {
      execFile(
        javacPath,
        compileArgs,
        {
          timeout: 35000,
          env: {
            ...process.env,
            CLASSPATH: classpath,
          },
        },
        (error, stdout, stderr) => {
          if (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
              reject(new Error('Java compiler not found. Install a JDK and ensure "javac" is on your PATH, or set "jarEditor.javaHome".'));
              return;
            }
            const details = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n');
            reject(new Error(details || error.message));
            return;
          }
          resolve();
        },
      );
    });
  }

  private getCompileArgs(classesRoot: string, sourcePath: string, target: string): string[] {
    const targetFeatureVersion = this.parseJavaTarget(target);
    const compileArgs = [
      '-encoding', 'UTF-8',
      '-Xlint:none',
      '-g',
      '-source', target === '1.1' ? '1.2' : target,
      '-target', target,
      '-d', classesRoot,
    ];

    if (targetFeatureVersion && targetFeatureVersion >= 8) {
      compileArgs.push('-parameters');
    }

    if (targetFeatureVersion && targetFeatureVersion >= 6) {
      compileArgs.push('-proc:none');
    }

    compileArgs.push(sourcePath);
    return compileArgs;
  }

  private getJavaSourceRelativePath(entryPath: string, text: string): string {
    const packageMatch = text.match(/^\s*package\s+([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*)\s*;/m);
    const packageSegments = packageMatch ? packageMatch[1].split('.') : [];
    const sourceFileName = path.basename(entryPath).replace(/\.class$/, '.java');
    return [...packageSegments, sourceFileName].join('/');
  }

  private isSpringBootClassesEntry(entryPath: string): boolean {
    return entryPath.startsWith(SPRING_BOOT_CLASSES_PREFIX);
  }

  private async prepareSpringBootDependencies(
    jarPath: string,
    dependencyClassesRoot: string,
    dependencyLibRoot: string,
  ): Promise<void> {
    const zip = new AdmZip(jarPath);

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) {
        if (entry.entryName.startsWith(SPRING_BOOT_CLASSES_PREFIX)) {
          const relativePath = entry.entryName.slice(SPRING_BOOT_CLASSES_PREFIX.length).replace(/\/$/, '');
          if (!relativePath) {
            continue;
          }
          await fs.promises.mkdir(path.join(dependencyClassesRoot, ...relativePath.split('/')), { recursive: true });
        }
        continue;
      }

      if (entry.entryName.startsWith(SPRING_BOOT_CLASSES_PREFIX)) {
        const relativePath = entry.entryName.slice(SPRING_BOOT_CLASSES_PREFIX.length);
        if (!relativePath) {
          continue;
        }
        const targetPath = path.join(dependencyClassesRoot, ...relativePath.split('/'));
        await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.promises.writeFile(targetPath, entry.getData());
        continue;
      }

      if (entry.entryName.startsWith(SPRING_BOOT_LIB_PREFIX) && entry.entryName.endsWith('.jar')) {
        const fileName = path.posix.basename(entry.entryName);
        if (!fileName) {
          continue;
        }
        const targetPath = path.join(dependencyLibRoot, fileName);
        await fs.promises.writeFile(targetPath, entry.getData());
      }
    }
  }

  private async getCompactDependencyClasspathEntries(dependencyLibRoot: string): Promise<string[]> {
    const entries = await fs.promises.readdir(dependencyLibRoot, { withFileTypes: true });
    const jarPaths = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.jar'))
      .map((entry) => path.join(dependencyLibRoot, entry.name))
      .sort((left, right) => path.basename(left).localeCompare(path.basename(right)));

    if (jarPaths.length === 0) {
      return [];
    }

    return [path.join(dependencyLibRoot, '*')];
  }

  private compactJarClasspathEntries(jarPaths: string[]): string[] {
    const uniqueJarPaths = Array.from(new Set(jarPaths));
    const groupedByDirectory = new Map<string, string[]>();

    for (const jarPath of uniqueJarPaths) {
      const directory = path.dirname(jarPath);
      const group = groupedByDirectory.get(directory);
      if (group) {
        group.push(jarPath);
      } else {
        groupedByDirectory.set(directory, [jarPath]);
      }
    }

    const compactedEntries: string[] = [];
    for (const [directory, group] of groupedByDirectory.entries()) {
      if (group.length > 1) {
        compactedEntries.push(path.join(directory, '*'));
        continue;
      }
      compactedEntries.push(group[0]);
    }

    return compactedEntries.sort((left, right) => left.localeCompare(right));
  }

  private async removePreviousCompiledArtifacts(outputRoot: string, entryPath: string): Promise<void> {
    const directoryPath = path.join(outputRoot, ...path.posix.dirname(entryPath).split('/').filter(Boolean));
    const baseName = path.posix.basename(entryPath, '.class');
    if (!fs.existsSync(directoryPath)) {
      return;
    }

    const children = await fs.promises.readdir(directoryPath);
    await Promise.all(children.map(async (child) => {
      const shouldDelete = child === `${baseName}.class` || (child.startsWith(`${baseName}$`) && child.endsWith('.class'));
      if (!shouldDelete) {
        return;
      }
      await fs.promises.rm(path.join(directoryPath, child), { force: true });
    }));
  }

  private async collectFiles(rootPath: string): Promise<string[]> {
    const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
    const results: string[] = [];

    for (const entry of entries) {
      const entryPath = path.join(rootPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...await this.collectFiles(entryPath));
      } else if (entry.isFile()) {
        results.push(entryPath);
      }
    }

    return results;
  }

  private writeZip(zip: AdmZip, targetPath: string): Promise<void> {
    this.normalizeZipEntriesForRewrite(zip);
    return new Promise((resolve, reject) => {
      zip.writeZip(targetPath, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private normalizeZipEntriesForRewrite(zip: AdmZip): void {
    for (const entry of zip.getEntries()) {
      // adm-zip rewrites local headers without emitting data descriptors.
      // Clear the descriptor flag so rewritten archives remain readable.
      (entry.header as typeof entry.header & { flags_desc?: boolean }).flags_desc = false;
    }
  }

  private async commitZipUpdate(zip: AdmZip, jarPath: string, outputJarPath: string): Promise<void> {
    try {
      await this.writeZip(zip, outputJarPath);
      await fs.promises.copyFile(outputJarPath, jarPath);
    } finally {
      await fs.promises.rm(outputJarPath, { force: true });
    }
  }

  private normalizeJarEntryPath(entryPath: string): string {
    const normalized = entryPath.trim().replace(/\\/g, '/');
    const trimmedTrailingSlash = normalized.replace(/\/+$/, '');

    if (!trimmedTrailingSlash) {
      throw new Error('Entry path is required.');
    }
    if (trimmedTrailingSlash.startsWith('/')) {
      throw new Error('Absolute paths are not allowed.');
    }

    const segments = trimmedTrailingSlash.split('/');
    if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
      throw new Error('Entry path must be a relative path without "." or ".." segments.');
    }

    return trimmedTrailingSlash;
  }

  private ensureDirectoryEntryPath(entryPath: string): string {
    return entryPath.endsWith('/') ? entryPath : `${entryPath}/`;
  }

  private detectJavacFeatureVersion(jdkHome?: string): number | undefined {
    const javacPath = jdkHome
      ? path.join(jdkHome, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac')
      : findJavaToolExecutable('javac');
    const result = spawnSync(javacPath, ['-version'], {
      encoding: 'utf8',
      timeout: 5000,
    });

    if (result.error || result.status !== 0) {
      return undefined;
    }

    const versionOutput = `${result.stdout}\n${result.stderr}`.trim();
    const match = versionOutput.match(/javac\s+([0-9]+)(?:\.([0-9]+))?/i);
    if (!match) {
      return undefined;
    }

    const major = Number(match[1]);
    const minor = match[2] ? Number(match[2]) : undefined;
    if (major === 1 && minor) {
      return minor;
    }
    return major;
  }

  private getClassFeatureVersion(jarPath: string, entryPath: string): number | undefined {
    const editedClassPath = path.join(getJarEditOutputRoot(jarPath), ...entryPath.split('/'));
    if (fs.existsSync(editedClassPath)) {
      const editedVersion = this.readClassFeatureVersion(fs.readFileSync(editedClassPath));
      if (editedVersion) {
        return editedVersion;
      }
    }

    const zip = new AdmZip(jarPath);
    const entry = zip.getEntry(entryPath);
    if (!entry) {
      return undefined;
    }

    return this.readClassFeatureVersion(entry.getData());
  }

  private readClassFeatureVersion(buffer: Buffer): number | undefined {
    if (buffer.length < 8 || buffer.readUInt32BE(0) !== 0xcafebabe) {
      return undefined;
    }
    return buffer.readUInt16BE(6);
  }

  private mapFeatureVersionToJavaTarget(featureVersion: number): string {
    if (featureVersion <= 45) {
      return '1.1';
    }

    if (featureVersion <= 52) {
      return `1.${featureVersion - 44}`;
    }

    return String(featureVersion - 44);
  }

  private parseJavaTarget(target: string): number | undefined {
    if (target.startsWith('1.')) {
      const legacyVersion = Number(target.slice(2));
      return Number.isInteger(legacyVersion) ? legacyVersion : undefined;
    }

    const featureVersion = Number(target);
    return Number.isInteger(featureVersion) ? featureVersion : undefined;
  }
}
