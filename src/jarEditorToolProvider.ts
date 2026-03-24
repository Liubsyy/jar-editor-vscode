import * as vscode from 'vscode';
import { JarEditService, JavaTargetOption } from './jarEditService';
import { JavaCompletionService } from './javaCompletionService';
import { JarModel } from './jarModel';
import { parseJarContentUri } from './utils';

export class JarEditorToolProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'jarEditor.textEditor';

  constructor(
    private readonly jarEditService: JarEditService,
    private readonly jarModel: JarModel,
    private readonly completionService: JavaCompletionService,
  ) {}

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
        case 'requestCompletion':
          this.handleCompletionRequest(webviewPanel, jarPath, message.requestId);
          break;
      }
    });

    webviewPanel.webview.html = this.getHtml(document.getText(), isJava, javaTargetOptions, defaultJavaTarget);

    if (isJava) {
      const classNames = this.completionService.getClassNamesForJar(jarPath, this.jarModel);
      void webviewPanel.webview.postMessage({ command: 'setJarClassNames', classNames });
    }
  }

  private handleCompletionRequest(webviewPanel: vscode.WebviewPanel, jarPath: string, requestId: number): void {
    const classNames = this.completionService.getClassNamesForJar(jarPath, this.jarModel);
    void webviewPanel.webview.postMessage({ command: 'completionResult', requestId, classNames });
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
      word-wrap: normal;
      overflow-wrap: normal;
      letter-spacing: normal;
      word-spacing: normal;
      text-rendering: auto;
      -webkit-text-size-adjust: none;
      overflow: auto;
    }
    textarea {
      cursor: text;
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
      overflow: hidden;
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

    /* Completion popup */
    .completion-popup {
      position: absolute;
      z-index: 10;
      max-height: 200px;
      min-width: 220px;
      max-width: 400px;
      overflow-y: auto;
      overflow-x: hidden;
      background: var(--vscode-editorSuggestWidget-background, var(--vscode-editor-background));
      border: 1px solid var(--vscode-editorSuggestWidget-border, var(--vscode-panel-border, rgba(128,128,128,0.4)));
      border-radius: 3px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      font-family: var(--vscode-editor-font-family, 'Courier New', monospace);
      font-size: var(--vscode-editor-font-size, 14px);
    }
    .completion-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 8px;
      cursor: pointer;
      white-space: nowrap;
    }
    .completion-item.selected {
      background: var(--vscode-editorSuggestWidget-selectedBackground, var(--vscode-list-activeSelectionBackground, #094771));
      color: var(--vscode-editorSuggestWidget-selectedForeground, var(--vscode-list-activeSelectionForeground, #fff));
    }
    .completion-item:hover:not(.selected) {
      background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.15));
    }
    .completion-kind {
      display: inline-block;
      min-width: 18px;
      height: 16px;
      line-height: 16px;
      text-align: center;
      font-size: 10px;
      font-weight: 600;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .ck-keyword { background: #569cd6; color: #fff; }
    .ck-class { background: #e2c08d; color: #1e1e1e; }
    .ck-method { background: #b180d7; color: #fff; }
    .ck-variable { background: #75beff; color: #1e1e1e; }
    .ck-snippet { background: #6a9955; color: #fff; }
    .completion-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .completion-detail {
      font-size: 11px;
      opacity: 0.6;
      margin-left: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
</head>
<body>
  <div class="editor-area">
    <pre id="highlighting"></pre>
    <textarea id="editor" spellcheck="false" wrap="off">${escaped}</textarea>
    <div id="completionPopup" class="completion-popup" style="display:none;"></div>
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
    const completionPopup = document.getElementById('completionPopup');

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
    const KW_ARR = Array.from(KW);

    /* ── Snippets ── */
    const SNIPPETS = [
      { label: 'sout', insertText: 'System.out.println()', detail: 'print to stdout' },
      { label: 'serr', insertText: 'System.err.println()', detail: 'print to stderr' },
      { label: 'main', insertText: 'public static void main(String[] args) {\\n    \\n}', detail: 'main method' },
      { label: 'fori', insertText: 'for (int i = 0; i < ; i++) {\\n    \\n}', detail: 'for loop' },
      { label: 'foreach', insertText: 'for ( : ) {\\n    \\n}', detail: 'enhanced for' },
      { label: 'ifelse', insertText: 'if () {\\n    \\n} else {\\n    \\n}', detail: 'if-else' },
      { label: 'trycatch', insertText: 'try {\\n    \\n} catch (Exception e) {\\n    \\n}', detail: 'try-catch' },
      { label: 'while', insertText: 'while () {\\n    \\n}', detail: 'while loop' },
      { label: 'psfs', insertText: 'public static final String ', detail: 'public static final String' },
    ];

    /* ── Completion state ── */
    var jarClassNames = [];
    var fileSymbols = [];
    var completionItems = [];
    var selectedIdx = 0;
    var completionVisible = false;
    var completionPrefix = '';
    var completionWordStart = 0;
    var symbolTimer = null;
    var afterDot = false;

    /* ── Mirror div for cursor position ── */
    var cursorMirror = null;
    function ensureMirror() {
      if (cursorMirror) return cursorMirror;
      cursorMirror = document.createElement('div');
      cursorMirror.id = 'cursorMirror';
      var s = cursorMirror.style;
      var cs = getComputedStyle(editor);
      s.position = 'absolute';
      s.top = '0';
      s.left = '0';
      s.visibility = 'hidden';
      s.whiteSpace = 'pre';
      s.fontFamily = cs.fontFamily;
      s.fontSize = cs.fontSize;
      s.lineHeight = cs.lineHeight;
      s.padding = cs.padding;
      s.border = cs.border;
      s.tabSize = cs.tabSize;
      s.letterSpacing = cs.letterSpacing;
      s.wordSpacing = cs.wordSpacing;
      s.width = cs.width;
      s.overflowWrap = 'normal';
      s.overflow = 'hidden';
      document.querySelector('.editor-area').appendChild(cursorMirror);
      return cursorMirror;
    }

    function getCursorPosition() {
      var mirror = ensureMirror();
      var text = editor.value.substring(0, editor.selectionStart);
      mirror.textContent = '';
      var textNode = document.createTextNode(text);
      var marker = document.createElement('span');
      marker.textContent = '|';
      mirror.appendChild(textNode);
      mirror.appendChild(marker);
      mirror.scrollTop = editor.scrollTop;
      mirror.scrollLeft = editor.scrollLeft;
      var top = marker.offsetTop - editor.scrollTop;
      var left = marker.offsetLeft - editor.scrollLeft;
      var lineH = parseFloat(getComputedStyle(editor).lineHeight) || 20;
      return { top: top + lineH + 2, left: left };
    }

    /* ── Symbol extraction ── */
    function extractSymbols(code) {
      var syms = new Map();
      var i = 0, n = code.length;
      var prevWord = '';
      while (i < n) {
        if (code[i] === '/' && i + 1 < n && code[i + 1] === '*') {
          var e = code.indexOf('*/', i + 2); i = e === -1 ? n : e + 2;
        } else if (code[i] === '/' && i + 1 < n && code[i + 1] === '/') {
          var e = code.indexOf('\\n', i); i = e === -1 ? n : e;
        } else if (code[i] === '"' || code[i] === "'") {
          var q = code[i], e = i + 1;
          while (e < n && code[e] !== q) { if (code[e] === '\\\\') e++; e++; }
          i = e < n ? e + 1 : n;
        } else if (/[A-Za-z_$]/.test(code[i])) {
          var e = i + 1;
          while (e < n && /[\\w$]/.test(code[e])) e++;
          var w = code.slice(i, e);
          if (!KW.has(w) && w !== 'true' && w !== 'false' && w !== 'null' && w.length > 1) {
            if (!syms.has(w)) {
              var kind = 'variable';
              if (prevWord === 'class' || prevWord === 'interface' || prevWord === 'enum' || prevWord === 'record') kind = 'class';
              else if (e < n && code[e] === '(') kind = 'method';
              else if (/^[A-Z]/.test(w)) kind = 'class';
              syms.set(w, kind);
            }
          }
          prevWord = w;
          i = e;
        } else {
          if (!/\\s/.test(code[i])) prevWord = '';
          i++;
        }
      }
      return Array.from(syms.entries()).map(function(e) { return { label: e[0], kind: e[1] }; });
    }

    function scheduleSymbolExtraction() {
      if (symbolTimer) clearTimeout(symbolTimer);
      symbolTimer = setTimeout(function() {
        fileSymbols = extractSymbols(editor.value);
      }, 300);
    }

    /* ── Completion popup ── */
    function getWordAtCursor() {
      var pos = editor.selectionStart;
      var text = editor.value;
      var start = pos;
      while (start > 0 && /[\\w$]/.test(text[start - 1])) start--;
      afterDot = start > 0 && text[start - 1] === '.';
      return { prefix: text.slice(start, pos), wordStart: start };
    }

    function gatherCompletions(prefix, forceShow) {
      var lc = prefix.toLowerCase();
      var items = [];
      var seen = new Set();

      if (afterDot) {
        // After dot: suggest methods and fields from current file
        for (var s of fileSymbols) {
          if ((s.kind === 'method' || s.kind === 'variable') && s.label.toLowerCase().startsWith(lc) && !seen.has(s.label)) {
            seen.add(s.label);
            items.push({ label: s.label, kind: s.kind, detail: '' });
          }
        }
      } else {
        // Keywords
        for (var kw of KW_ARR) {
          if (kw.startsWith(lc) && !seen.has(kw)) {
            seen.add(kw);
            items.push({ label: kw, kind: 'keyword', detail: '' });
          }
        }
        // Current file symbols
        for (var s of fileSymbols) {
          if (s.label.toLowerCase().startsWith(lc) && !seen.has(s.label)) {
            seen.add(s.label);
            items.push({ label: s.label, kind: s.kind, detail: '' });
          }
        }
        // JAR class names
        for (var c of jarClassNames) {
          if (c.simpleName.toLowerCase().startsWith(lc) && !seen.has(c.simpleName)) {
            seen.add(c.simpleName);
            items.push({ label: c.simpleName, kind: 'class', detail: c.fullQualifiedName });
          }
        }
        // Snippets
        for (var sn of SNIPPETS) {
          if (sn.label.startsWith(lc) && !seen.has(sn.label)) {
            seen.add(sn.label);
            items.push({ label: sn.label, kind: 'snippet', detail: sn.detail, insertText: sn.insertText });
          }
        }
      }

      // Sort: exact prefix first, then alphabetical
      items.sort(function(a, b) {
        var aExact = a.label.toLowerCase() === lc ? 0 : 1;
        var bExact = b.label.toLowerCase() === lc ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.label.localeCompare(b.label);
      });

      return items.slice(0, 20);
    }

    function showCompletion(forceShow) {
      if (!IS_JAVA) return;
      var wc = getWordAtCursor();
      completionPrefix = wc.prefix;
      completionWordStart = wc.wordStart;

      if (!forceShow && !afterDot && completionPrefix.length < 2) {
        hideCompletion();
        return;
      }

      var items = gatherCompletions(completionPrefix, forceShow);
      if (items.length === 0) {
        hideCompletion();
        return;
      }

      completionItems = items;
      selectedIdx = 0;
      renderPopup();
      positionPopup();
      completionPopup.style.display = 'block';
      completionVisible = true;
    }

    function renderPopup() {
      var html = '';
      for (var i = 0; i < completionItems.length; i++) {
        var it = completionItems[i];
        var sel = i === selectedIdx ? ' selected' : '';
        var kindCls = 'ck-' + it.kind;
        var kindLabel = it.kind === 'keyword' ? 'K' : it.kind === 'class' ? 'C' : it.kind === 'method' ? 'M' : it.kind === 'variable' ? 'V' : 'S';
        html += '<div class="completion-item' + sel + '" data-index="' + i + '">'
          + '<span class="completion-kind ' + kindCls + '">' + kindLabel + '</span>'
          + '<span class="completion-label">' + esc(it.label) + '</span>'
          + (it.detail ? '<span class="completion-detail">' + esc(it.detail) + '</span>' : '')
          + '</div>';
      }
      completionPopup.innerHTML = html;

      var items = completionPopup.querySelectorAll('.completion-item');
      items.forEach(function(el) {
        el.addEventListener('mousedown', function(ev) {
          ev.preventDefault();
          acceptCompletion(parseInt(el.getAttribute('data-index')));
        });
      });
    }

    function positionPopup() {
      var pos = getCursorPosition();
      var editorArea = document.querySelector('.editor-area');
      var areaRect = editorArea.getBoundingClientRect();
      var popupH = Math.min(completionPopup.scrollHeight, 200);
      var top = pos.top;
      // Flip above cursor if near bottom
      if (top + popupH > areaRect.height) {
        var lineH = parseFloat(getComputedStyle(editor).lineHeight) || 20;
        top = pos.top - lineH - popupH - 4;
        if (top < 0) top = 0;
      }
      completionPopup.style.top = top + 'px';
      completionPopup.style.left = Math.min(pos.left, areaRect.width - 240) + 'px';
    }

    function hideCompletion() {
      completionPopup.style.display = 'none';
      completionVisible = false;
      completionItems = [];
    }

    function acceptCompletion(idx) {
      if (idx < 0 || idx >= completionItems.length) return;
      var it = completionItems[idx];
      var text = it.insertText || it.label;
      var before = editor.value.substring(0, completionWordStart);
      var after = editor.value.substring(editor.selectionStart);
      editor.value = before + text + after;
      var newPos = completionWordStart + text.length;
      editor.selectionStart = editor.selectionEnd = newPos;
      hideCompletion();
      updateHighlighting();
      vscode.postMessage({ command: 'contentChanged', text: editor.value });
      editor.focus();
    }

    function updateSelection(newIdx) {
      if (newIdx < 0) newIdx = completionItems.length - 1;
      if (newIdx >= completionItems.length) newIdx = 0;
      selectedIdx = newIdx;
      var children = completionPopup.querySelectorAll('.completion-item');
      children.forEach(function(el, i) {
        el.classList.toggle('selected', i === selectedIdx);
      });
      // Scroll selected into view
      if (children[selectedIdx]) {
        children[selectedIdx].scrollIntoView({ block: 'nearest' });
      }
    }

    /* ── Syntax highlighting (unchanged logic) ── */
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
        // Append trailing newline so <pre> has same visual height as textarea
        hl.innerHTML = highlightJava(editor.value) + '\\n';
      }
    }

    if (targetSelect) {
      targetSelect.addEventListener('change', function() {
        vscode.postMessage({ command: 'targetChanged', target: targetSelect.value });
      });
    }

    /* ── Message handler ── */
    window.addEventListener('message', function(event) {
      var message = event.data;
      if (!message) return;

      if (message.command === 'setContent' && typeof message.text === 'string') {
        if (editor.value === message.text) return;
        var selectionStart = editor.selectionStart;
        var selectionEnd = editor.selectionEnd;
        var scrollTop = editor.scrollTop;
        var scrollLeft = editor.scrollLeft;
        editor.value = message.text;
        updateHighlighting();
        editor.selectionStart = Math.min(selectionStart, editor.value.length);
        editor.selectionEnd = Math.min(selectionEnd, editor.value.length);
        editor.scrollTop = scrollTop;
        editor.scrollLeft = scrollLeft;
        hl.scrollTop = scrollTop;
        hl.scrollLeft = scrollLeft;
        fileSymbols = extractSymbols(editor.value);
      } else if (message.command === 'setJarClassNames' && Array.isArray(message.classNames)) {
        jarClassNames = message.classNames;
      } else if (message.command === 'completionResult' && Array.isArray(message.classNames)) {
        jarClassNames = message.classNames;
        if (completionVisible) showCompletion(false);
      }
    });

    editor.addEventListener('scroll', function() {
      hl.scrollTop = editor.scrollTop;
      hl.scrollLeft = editor.scrollLeft;
      if (completionVisible) hideCompletion();
    });

    editor.addEventListener('input', function() {
      updateHighlighting();
      vscode.postMessage({ command: 'contentChanged', text: editor.value });
      scheduleSymbolExtraction();
      if (IS_JAVA) showCompletion(false);
    });

    editor.addEventListener('keydown', function(e) {
      if (completionVisible) {
        if (e.key === 'ArrowDown') { e.preventDefault(); updateSelection(selectedIdx + 1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); updateSelection(selectedIdx - 1); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); acceptCompletion(selectedIdx); return; }
        if (e.key === 'Escape') { e.preventDefault(); hideCompletion(); return; }
      }
      // Ctrl+Space / Cmd+Space to trigger completion
      if (e.key === ' ' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        showCompletion(true);
        return;
      }
      if (e.key === 'Enter' && !completionVisible) {
        e.preventDefault();
        var pos = editor.selectionStart;
        var val = editor.value;
        var lineStart = val.lastIndexOf('\\n', pos - 1) + 1;
        var indent = '';
        for (var ci = lineStart; ci < val.length && (val[ci] === ' ' || val[ci] === '\\t'); ci++) {
          indent += val[ci];
        }
        var insert = '\\n' + indent;
        editor.value = val.substring(0, pos) + insert + val.substring(editor.selectionEnd);
        editor.selectionStart = editor.selectionEnd = pos + insert.length;
        updateHighlighting();
        vscode.postMessage({ command: 'contentChanged', text: editor.value });
        return;
      }
      if (e.key === 'Tab' && !completionVisible) {
        e.preventDefault();
        var start = editor.selectionStart;
        var end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 4;
        updateHighlighting();
        vscode.postMessage({ command: 'contentChanged', text: editor.value });
      }
    });

    editor.addEventListener('blur', function() {
      setTimeout(function() { hideCompletion(); }, 150);
    });

    // Initial setup
    updateHighlighting();
    if (IS_JAVA) fileSymbols = extractSymbols(editor.value);
  </script>
</body>
</html>`;
  }
}
