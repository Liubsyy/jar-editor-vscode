# .class 自定义编辑器代码补全

## 当前状态

已实现。自定义编辑器（webview）内置了完整的代码补全系统，包括关键字、当前文件符号、JAR 类名、代码片段四类补全，以及回车自动缩进和光标对齐。

## 整体架构

采用混合架构：快速补全（关键字、当前文件符号、代码片段）在 webview 端本地计算，无需 round-trip；JAR 内类名在编辑器打开时由 extension host 预加载到 webview。

```
Webview                          Extension Host
┌─────────────────┐              ┌──────────────────────┐
│ 输入检测         │              │ JavaCompletionService│
│ 符号提取         │  postMessage │  - JAR 类名提取/缓存  │
│ 关键字/片段匹配  │ ←──────────→ │  - 预加载类名         │
│ 弹出层 UI       │              │                      │
│ 键盘/鼠标交互    │              │ JarEditorToolProvider│
└─────────────────┘              │  - 消息分发           │
                                 └──────────────────────┘
```

## 补全类型

| 类型 | 来源 | 计算位置 | 图标/标记 |
|------|------|----------|----------|
| Java 关键字 | 静态列表（复用已有 `KW` 集合） | Webview | `K`（蓝色） |
| 当前文件符号 | 正则解析当前源码文本 | Webview | `M`/`C`/`V` |
| JAR 类名 | `JarArchive` 树遍历，编辑器打开时预加载 | Extension Host → Webview | `C`（黄色） |
| 代码片段 | 静态列表 | Webview | `S`（绿色） |

## 触发条件

- 输入字母后前缀 >= 2 个字符时自动弹出
- `Ctrl+Space`（Mac: `Cmd+Space`）手动触发，显示全部候选项
- 输入 `.` 后触发，补全当前文件内的方法/字段名

## 代码片段列表

| 缩写 | 展开内容 |
|------|---------|
| `sout` | `System.out.println()` |
| `serr` | `System.err.println()` |
| `main` | `public static void main(String[] args) { }` |
| `fori` | `for (int i = 0; i < ; i++) { }` |
| `foreach` | `for ( : ) { }` |
| `ifelse` | `if () { } else { }` |
| `trycatch` | `try { } catch (Exception e) { }` |
| `while` | `while () { }` |
| `psfs` | `public static final String ` |

## 键盘交互

| 按键 | 弹出层可见时 | 弹出层不可见时 |
|------|-------------|---------------|
| `↑` / `↓` | 移动选中项 | 默认行为 |
| `Enter` | 接受补全 | 换行并自动缩进（继承上一行缩进） |
| `Tab` | 接受补全 | 插入 4 空格 |
| `Escape` | 关闭弹出层 | 默认行为 |
| `Ctrl+Space` | — | 手动触发补全 |

## 消息协议

| 方向 | Command | 说明 |
|------|---------|------|
| Host → Webview | `setJarClassNames` | 编辑器打开时预加载 JAR 类名 |
| Webview → Host | `requestCompletion` | 请求刷新类名（JAR 重建后） |
| Host → Webview | `completionResult` | 返回类名数据 |

## 编辑器优化

- textarea 与 `<pre>` 高亮层精确对齐：统一 `word-wrap`、`overflow-wrap`、`letter-spacing`、`word-spacing`、`white-space: pre`
- textarea 设置 `wrap="off"` 防止软换行
- `<pre>` 设置 `overflow: hidden`，滚动由 JS 同步驱动
- `updateHighlighting()` 追加尾部 `\n`，避免 `<pre>` 吞掉末尾空行导致光标偏移
- 鼠标指针在编辑区显示为 I 形（`cursor: text`）
- 回车自动缩进：检测上一行前导空白并复制

## 主要文件

| 文件 | 说明 |
|------|------|
| `src/javaCompletionService.ts` | 从 JAR 中提取类名并缓存，供 webview 使用 |
| `src/jarModel.ts` | `JarArchive.getAllClassEntryPaths()` 递归收集顶层 `.class` 路径 |
| `src/jarEditorToolProvider.ts` | 自定义编辑器：补全弹出层 CSS/DOM/JS、消息处理、预加载 |
| `src/extension.ts` | 实例化 `JavaCompletionService`，传入编辑器提供者 |

## 验证方式

1. 打开一个 `.class` 条目
2. 输入 `pub` → 应弹出 `public` 关键字建议
3. `Enter` 或 `Tab` 接受 → 应插入 `public`
4. 输入 `Str` → 应弹出 JAR 中的类名
5. `Ctrl+Space` 空行触发 → 应显示全部关键字 + 代码片段
6. 输入 `sout` 并接受 → 应插入 `System.out.println()`
7. 按回车 → 光标应与上一行缩进对齐
8. 鼠标悬停编辑区 → 应显示 I 形光标
9. 验证现有功能不受影响：Save、Build Jar、语法高亮、Tab 缩进、滚动同步
10. 大 JAR（Spring Boot）测试 → 无明显延迟
