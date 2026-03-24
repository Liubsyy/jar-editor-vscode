import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { execFile } from 'child_process';

export function findJavaToolExecutable(toolName: 'java' | 'javac'): string {
  const executable = process.platform === 'win32' ? `${toolName}.exe` : toolName;
  const config = vscode.workspace.getConfiguration('jarEditor');
  const javaHome = config.get<string>('javaHome');
  if (javaHome) {
    const configured = path.join(javaHome, 'bin', executable);
    if (fs.existsSync(configured)) {
      return configured;
    }
  }

  if (process.env.JAVA_HOME) {
    const fromEnv = path.join(process.env.JAVA_HOME, 'bin', executable);
    if (fs.existsSync(fromEnv)) {
      return fromEnv;
    }
  }

  return executable;
}

export class JavaDecompiler {
  private cache = new Map<string, string>();
  private readonly cfrPath: string;

  constructor(extensionPath: string) {
    this.cfrPath = path.join(extensionPath, 'decompilers', 'cfr.jar');
  }

  async decompile(
    classBytes: Buffer,
    cacheKey: string,
    className?: string,
    innerClasses?: { name: string; data: Buffer }[],
  ): Promise<string> {
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (classBytes.length === 0) {
      this.cache.set(cacheKey, '');
      return '';
    }

    const javaPath = findJavaToolExecutable('java');
    const result = await this.runCfr(javaPath, classBytes, className, innerClasses);
    this.cache.set(cacheKey, result);
    return result;
  }

  clearCache(jarPath?: string): void {
    if (!jarPath) {
      this.cache.clear();
      return;
    }
    const prefix = jarPath + '!/';
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  private runCfr(
    javaPath: string,
    classBytes: Buffer,
    className?: string,
    innerClasses?: { name: string; data: Buffer }[],
  ): Promise<string> {
    return new Promise((resolve) => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jar-editor-'));
      const mainFileName = className || `jar-editor-${Date.now()}.class`;
      const tmpFile = path.join(tmpDir, mainFileName);
      fs.writeFileSync(tmpFile, classBytes);

      // Write inner class files so CFR can resolve them
      if (innerClasses) {
        for (const ic of innerClasses) {
          fs.writeFileSync(path.join(tmpDir, ic.name), ic.data);
        }
      }

      execFile(
        javaPath,
        ['-jar', this.cfrPath, tmpFile],
        { timeout: 35000 },
        (error, stdout, stderr) => {
          try {
            fs.rmSync(tmpDir, { recursive: true });
          } catch {
            // ignore cleanup errors
          }

          if (error) {
            resolve(
              `// Decompilation failed: ${error.message}\n` +
              (stderr ? `// ${stderr.replace(/\n/g, '\n// ')}\n` : ''),
            );
            return;
          }

          resolve(stdout);
        },
      );
    });
  }
}
