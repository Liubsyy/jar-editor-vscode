import * as vscode from 'vscode';
import { JarEditService, JavaTargetOption } from './jarEditService';
import { parseJarContentUri } from './utils';

export class JarEditorToolProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'jarEditor.textEditor';

  constructor(private readonly jarEditService: JarEditService) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    webviewPanel.webview.options = { enableScripts: true };

    const { jarPath, entryPath } = parseJarContentUri(document.uri);
    const isJava = document.uri.path.endsWith('.class');
    const javaTargetOptions = this.jarEditService.getJavaTargetOptions();
    const defaultJavaTarget = isJava
      ? this.jarEditService.getDefaultJavaTargetForClassEntry(jarPath, entryPath)
      : this.jarEditService.getDefaultJavaTarget();
    let isUpdatingFromWebview = false;
    let currentText = document.getText();
    let currentTarget = defaultJavaTarget;

    const updateWebview = () => {
      currentText = document.getText();
      webviewPanel.webview.postMessage({
        command: 'setContent',
        text: currentText,
      });
    };

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        if (isUpdatingFromWebview) {
          isUpdatingFromWebview = false;
          return;
        }
        updateWebview();
      }
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'save':
          await this.handleSave(document, currentText, currentTarget);
          break;
        case 'buildJar':
          await this.handleBuildJar(document, currentText);
          break;
        case 'contentChanged':
          isUpdatingFromWebview = true;
          currentText = message.text;
          void this.updateDocument(document, message.text);
          break;
        case 'targetChanged':
          currentTarget = message.target;
          break;
      }
    });

    webviewPanel.webview.html = this.getHtml(document.getText(), isJava, javaTargetOptions, defaultJavaTarget);
  }

  private async handleSave(document: vscode.TextDocument, currentText: string, target: string): Promise<void> {
    const { jarPath, entryPath } = parseJarContentUri(document.uri);

    try {
      const result = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Window, title: `Saving ${entryPath}...` },
        () => this.jarEditService.saveEntry(jarPath, entryPath, currentText, target),
      );
      await this.persistDocumentState(document, currentText);
      vscode.window.showInformationMessage(`Save successfully,out=${result.outputPath}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Save failed for ${entryPath}: ${this.getErrorMessage(error)}`);
    }
  }

  private async handleBuildJar(document: vscode.TextDocument, currentText: string): Promise<void> {
    const { jarPath } = parseJarContentUri(document.uri);

    try {
      const updatedJarPath = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Window, title: 'Applying changes to JAR...' },
        () => this.jarEditService.buildJar(jarPath),
      );
      await this.persistDocumentState(document, currentText);
      vscode.window.showInformationMessage(`Build Jar successfully: ${updatedJarPath}`);
    } catch (error) {
      const message = this.getErrorMessage(error);
      if (message === 'Nothing modified') {
        vscode.window.showInformationMessage(message);
        return;
      }
      vscode.window.showErrorMessage(`Build Jar failed: ${message}`);
    }
  }

  private async updateDocument(document: vscode.TextDocument, text: string): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      text,
    );
    await vscode.workspace.applyEdit(edit);
  }

  private async persistDocumentState(document: vscode.TextDocument, text: string): Promise<void> {
    if (document.getText() !== text) {
      await this.updateDocument(document, text);
    }
    await document.save();
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private getHtml(
    content: string,
    isJava: boolean,
    javaTargetOptions: JavaTargetOption[],
    defaultJavaTarget: string,
  ): string {
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const targetOptionsHtml = javaTargetOptions
      .map((option) => {
        const selected = option.value === defaultJavaTarget ? ' selected' : '';
        return `<option value="${option.value}"${selected}>${option.label}</option>`;
      })
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
    .editor-area {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    #highlighting, textarea {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 8px 12px;
      margin: 0;
      border: none;
      font-family: var(--vscode-editor-font-family, 'Courier New', monospace);
      font-size: var(--vscode-editor-font-size, 14px);
      line-height: var(--vscode-editor-line-height, 1.5);
      tab-size: 4;
      white-space: pre;
      overflow: auto;
    }
    textarea {
      background: transparent;
      color: ${isJava ? 'transparent' : 'var(--vscode-editor-foreground)'};
      ${isJava ? '-webkit-text-fill-color: transparent;' : ''}
      caret-color: var(--vscode-editor-foreground);
      z-index: 1;
      resize: none;
      outline: none;
    }
    textarea:focus,
    textarea:focus-visible {
      border: none;
      outline: none;
      box-shadow: none;
    }
    .editor-area:focus-within {
      outline: none;
      box-shadow: none;
    }
    #highlighting {
      z-index: 0;
      pointer-events: none;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      display: ${isJava ? 'block' : 'none'};
    }
    /* Java syntax - dark theme */
    body.vscode-dark .kw { color: #569cd6; }
    body.vscode-dark .str { color: #ce9178; }
    body.vscode-dark .cmt { color: #6a9955; }
    body.vscode-dark .num { color: #b5cea8; }
    body.vscode-dark .ann { color: #dcdcaa; }
    body.vscode-dark .lit { color: #569cd6; }
    /* Java syntax - light theme */
    body.vscode-light .kw { color: #0000ff; }
    body.vscode-light .str { color: #a31515; }
    body.vscode-light .cmt { color: #008000; }
    body.vscode-light .num { color: #098658; }
    body.vscode-light .ann { color: #808000; }
    body.vscode-light .lit { color: #0000ff; }
    /* Java syntax - high contrast */
    body.vscode-high-contrast .kw { color: #569cd6; }
    body.vscode-high-contrast .str { color: #ce9178; }
    body.vscode-high-contrast .cmt { color: #7ca668; }
    body.vscode-high-contrast .num { color: #b5cea8; }
    body.vscode-high-contrast .ann { color: #dcdcaa; }
    body.vscode-high-contrast .lit { color: #569cd6; }

    .toolbar-wrapper {
      flex-shrink: 0;
      padding: 0 12px 10px 12px;
    }
    .toolbar-title {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.3px;
      color: var(--vscode-panelTitle-activeForeground, var(--vscode-editor-foreground));
      padding: 8px 0 6px 2px;
      border-top: 1px solid var(--vscode-panel-border, var(--vscode-sideBar-border, #444));
    }
    .toolbar-box {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding: 8px 12px;
      background: rgba(128, 128, 128, 0.06);
      border: 1px solid var(--vscode-panel-border, var(--vscode-sideBar-border, rgba(128,128,128,0.3)));
      border-radius: 4px;
    }
    .toolbar-right {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
    }
    .toolbar-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground, var(--vscode-editor-foreground));
      white-space: nowrap;
    }
    select {
      min-width: 118px;
      padding: 4px 8px;
      border-radius: 3px;
      border: 1px solid var(--vscode-dropdown-border, var(--vscode-panel-border, rgba(128,128,128,0.3)));
      color: var(--vscode-dropdown-foreground, var(--vscode-editor-foreground));
      background: var(--vscode-dropdown-background, var(--vscode-editor-background));
      font-size: 12px;
    }
    button {
      padding: 5px 16px;
      cursor: pointer;
      border: none;
      border-radius: 3px;
      font-size: 12px;
      font-weight: 500;
      color: var(--vscode-button-foreground);
      background-color: var(--vscode-button-background);
      transition: background-color 0.15s;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <div class="editor-area">
    <pre id="highlighting"></pre>
    <textarea id="editor" spellcheck="false">${escaped}</textarea>
  </div>
  <div class="toolbar-wrapper">
    <div class="toolbar-title">JarEditor Tools</div>
    <div class="toolbar-box">
      <div class="toolbar-right">
        <label class="toolbar-label" for="targetSelect" style="display: ${isJava ? 'inline' : 'none'};">Target</label>
        <select id="targetSelect" style="display: ${isJava ? 'inline-block' : 'none'};">${targetOptionsHtml}</select>
        <button onclick="send('save')">Save</button>
        <button onclick="send('buildJar')">Build Jar</button>
      </div>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const IS_JAVA = ${isJava};

    function send(cmd) {
      vscode.postMessage({ command: cmd });
    }

    const editor = document.getElementById('editor');
    const hl = document.getElementById('highlighting');
    const targetSelect = document.getElementById('targetSelect');

    function esc(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const KW = new Set([
      'abstract','assert','boolean','break','byte','case','catch','char','class',
      'const','continue','default','do','double','else','enum','extends','final',
      'finally','float','for','goto','if','implements','import','instanceof','int',
      'interface','long','native','new','package','private','protected','public',
      'return','short','static','strictfp','super','switch','synchronized','this',
      'throw','throws','transient','try','void','volatile','while','var','record',
      'sealed','permits','yield'
    ]);

    function highlightJava(code) {
      var r = '', i = 0, n = code.length;
      while (i < n) {
        if (code[i] === '/' && i + 1 < n && code[i + 1] === '*') {
          var e = code.indexOf('*/', i + 2);
          e = e === -1 ? n : e + 2;
          r += '<span class="cmt">' + esc(code.slice(i, e)) + '</span>';
          i = e;
        } else if (code[i] === '/' && i + 1 < n && code[i + 1] === '/') {
          var e = code.indexOf('\\n', i);
          if (e === -1) e = n;
          r += '<span class="cmt">' + esc(code.slice(i, e)) + '</span>';
          i = e;
        } else if (code[i] === '"') {
          var e = i + 1;
          while (e < n && code[e] !== '"') { if (code[e] === '\\\\') e++; e++; }
          if (e < n) e++;
          r += '<span class="str">' + esc(code.slice(i, e)) + '</span>';
          i = e;
        } else if (code[i] === "'") {
          var e = i + 1;
          while (e < n && code[e] !== "'") { if (code[e] === '\\\\') e++; e++; }
          if (e < n) e++;
          r += '<span class="str">' + esc(code.slice(i, e)) + '</span>';
          i = e;
        } else if (code[i] === '@' && i + 1 < n && /[A-Za-z]/.test(code[i + 1])) {
          var e = i + 1;
          while (e < n && /[\\w$]/.test(code[e])) e++;
          r += '<span class="ann">' + esc(code.slice(i, e)) + '</span>';
          i = e;
        } else if (/[A-Za-z_$]/.test(code[i])) {
          var e = i + 1;
          while (e < n && /[\\w$]/.test(code[e])) e++;
          var w = code.slice(i, e);
          if (w === 'true' || w === 'false' || w === 'null') {
            r += '<span class="lit">' + esc(w) + '</span>';
          } else if (KW.has(w)) {
            r += '<span class="kw">' + esc(w) + '</span>';
          } else {
            r += esc(w);
          }
          i = e;
        } else if (/[0-9]/.test(code[i])) {
          var e = i + 1;
          while (e < n && /[0-9a-fA-FxXlLfFdD._]/.test(code[e])) e++;
          r += '<span class="num">' + esc(code.slice(i, e)) + '</span>';
          i = e;
        } else {
          r += esc(code[i]);
          i++;
        }
      }
      return r;
    }

    function updateHighlighting() {
      if (IS_JAVA) {
        hl.innerHTML = highlightJava(editor.value);
      }
    }

    if (targetSelect) {
      targetSelect.addEventListener('change', function() {
        vscode.postMessage({ command: 'targetChanged', target: targetSelect.value });
      });
    }

    window.addEventListener('message', function(event) {
      const message = event.data;
      if (!message || message.command !== 'setContent' || typeof message.text !== 'string') {
        return;
      }
      if (editor.value === message.text) {
        return;
      }

      const selectionStart = editor.selectionStart;
      const selectionEnd = editor.selectionEnd;
      const scrollTop = editor.scrollTop;
      const scrollLeft = editor.scrollLeft;

      editor.value = message.text;
      updateHighlighting();
      editor.selectionStart = Math.min(selectionStart, editor.value.length);
      editor.selectionEnd = Math.min(selectionEnd, editor.value.length);
      editor.scrollTop = scrollTop;
      editor.scrollLeft = scrollLeft;
      hl.scrollTop = scrollTop;
      hl.scrollLeft = scrollLeft;
    });

    editor.addEventListener('scroll', function() {
      hl.scrollTop = editor.scrollTop;
      hl.scrollLeft = editor.scrollLeft;
    });

    editor.addEventListener('input', function() {
      updateHighlighting();
      vscode.postMessage({ command: 'contentChanged', text: editor.value });
    });

    editor.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var start = editor.selectionStart;
        var end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 4;
        updateHighlighting();
        vscode.postMessage({ command: 'contentChanged', text: editor.value });
      }
    });

    updateHighlighting();
  </script>
</body>
</html>`;
  }
}
