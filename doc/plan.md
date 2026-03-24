# JAR Editor VSCode 扩展

## 当前架构

该扩展会自动扫描工作区中的 JAR 文件，在 Explorer 侧边栏的 `jarEditor` 视图中展示其内容，并支持普通条目查看、`.class` 反编译编辑以及重新打包回写。

核心模块如下：

- `src/extension.ts`：注册 Provider、命令以及扫描器串联逻辑
- `src/jarScanner.ts`：扫描 `**/*.jar` 并监听新增、删除、变化
- `src/jarModel.ts`：读取 JAR 内容并构建树结构
- `src/jarExplorerProvider.ts`：渲染树视图并隐藏内部类
- `src/jarFileSystemProvider.ts`：提供 `jar-contents:` 原始内容
- `src/decompileContentProvider.ts`：提供 `jar-decompiled:` 反编译内容
- `src/jarEditorToolProvider.ts`：提供可编辑的自定义 webview 编辑器
- `src/jarEditService.ts`：负责保存编辑结果和重建 JAR
- `src/javaDecompiler.ts`：使用 CFR 处理 `.class` 反编译
- `src/utils.ts`：URI 和输出路径辅助函数

## URI Scheme

### 原始条目内容

```text
jar-contents:///absolute/path/to/file.jar!/path/inside.jar
```

### 反编译后的 class 内容

```text
jar-decompiled:///absolute/path/to/file.jar!/path/inside.jar
```

两种 scheme 都使用 `!/` 作为外部 JAR 路径和内部 entry 路径的分隔符。

## 用户可见行为

### Explorer 树

- 视图 ID 为 `jarEditor`
- 工作区内的 JAR 会自动发现并展示
- 若 JAR 位于子目录下，会先展示上层目录节点，再展开到具体 JAR
- 多根工作区下，会先按 workspace folder 分组展示
- 目录排在文件前面，各自按字母序排序
- 文件名包含 `$` 的内部类 `.class` 会在树中隐藏

### 打开条目

- 非 `.class` 条目通过 `jar-contents:` 打开
- `.class` 条目通过反编译命令和自定义编辑器打开

### 编辑与保存

- 所有打开的条目都可以在自定义 webview 编辑器中修改
- 普通文本条目保存到 `<jarBase>_temp/jar_edit_out`
- `.class` 条目会从编辑后的 Java 源码重新编译
- `Build Jar` 会将已保存产物合并回原始 JAR

## 命令

- `jarEditor.refresh`：重新扫描工作区 JAR 文件
- `jarEditor.openClass`：反编译并打开 `.class` 条目

## Java 工具链

反编译和编译都复用同一套 Java 可执行文件查找逻辑：

1. `jarEditor.javaHome`
2. `JAVA_HOME`
3. `PATH`

对于 `.class` 保存流程：

- 工具栏会显示 `Target` 下拉框
- 默认值优先取当前打开 class 文件本身的字节码版本
- 可选 target 的上限由本机 `javac` 决定

## 输出目录约定

假设原始 JAR 为 `/path/to/a.jar`：

- 编辑输出目录：`/path/to/a_temp/jar_edit_out`
- 临时重建 JAR：`/path/to/a_edited.jar`

点击 `Build Jar` 后，会先生成 `_edited.jar`，再覆盖原始 `a.jar`，最后删除该临时 JAR。

## 当前状态说明

最初的实现计划已经不再准确，当前项目状态与早期计划相比有这些差异：

- 项目已经完成基础实现，不再是纯脚手架阶段
- 实际视图 ID 是 `jarEditor`，不是 `jarExplorer`
- `.class` 处理已经包含反编译、可编辑源码、按 target 重新编译以及回写 JAR 的完整链路

## 验证方式

1. 运行 `npm run compile`
2. 在 VSCode 中按 F5 启动 Extension Host
3. 确认 `jarEditor` 视图能列出工作区中的 JAR 文件
4. 打开普通文本条目，确认可编辑内容正常显示
5. 打开 `.class` 条目，确认显示反编译后的 Java 源码
6. 保存修改后的 class，确认 `jar_edit_out` 中生成新的编译产物
7. 执行 `Build Jar`，确认原始 JAR 被更新
