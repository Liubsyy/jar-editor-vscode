# JAR Editor

[中文](./README.md) | [English](./README_en.md)

一个用于 VSCode 的 JAR 浏览与编辑扩展。

它可以在 Explorer 侧边栏中扫描工作区内的 JAR 文件，展示其内部目录结构，并支持查看、编辑、反编译、重新编译以及直接修改 JAR 内条目。

## 功能特性

- 自动扫描工作区中的 `*.jar`
- 在 `jarEditor` 视图中展示 JAR 内目录树
- 普通条目可直接打开并编辑
- `.class` 条目会先通过 CFR 反编译为 Java 源码再打开
- 自定义编辑器内置 `Save` 和 `Build Jar`
- `.class` 保存时会调用 `javac` 重新编译
- Explorer 右键支持 `Add` 和 `Delete`
- 支持直接向原始 JAR 新增空文件
- 支持删除单个 entry 或递归删除整个目录
- 新增的空 `.class` 文件会以空文本形式打开，便于直接输入 Java 源码

## 安装与运行

### 环境要求

- Node.js
- VSCode `^1.85.0`
- 若要反编译或编译 `.class`，本机需要可用的 Java 环境

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build
```

### 开发编译

```bash
npm run compile
```

### 调试

在 VSCode 中按 `F5` 启动 Extension Development Host。

## 使用说明

### 浏览 JAR

启动扩展后，工作区中的 JAR 会自动出现在 Explorer 侧边栏的 `JAR Editor` 视图中。

树视图行为：

- 目录排在文件前面
- 同级节点按字母排序
- 文件名包含 `$` 的内部类 `.class` 默认隐藏

### 打开文件

- 非 `.class` 文件通过 `jar-contents:` 打开
- `.class` 文件触发 `jarEditor.openClass`，先反编译再打开

### 编辑与保存

所有打开条目都会使用自定义编辑器 `jarEditor.textEditor`。

- 普通文本条目点击 `Save` 后，内容写入 `<jarBase>_temp/jar_edit_out`
- `.class` 条目点击 `Save` 后，当前文本会被视为 Java 源码并重新编译
- 点击 `Build Jar` 后，`jar_edit_out` 中的产物会被合并回原始 JAR

### 右键菜单

Explorer 右键支持以下操作：

- JAR 根节点：`Add`
- 目录节点：`Add`、`Delete`
- 文件节点：`Delete`

#### Add

- 弹出输入框
- 输入相对于当前节点的相对路径，例如 `a.txt` 或 `nested/path/A.class`
- 直接向原始 JAR 写入一个空文件

#### Delete

- 删除单个文件，或递归删除目录下所有 entry
- 删除前会弹出确认框
- 删除后会重写原始 JAR

## `.class` 处理说明

### 反编译

扩展使用内置的 CFR：

```text
decompilers/cfr.jar
```

`.class` 打开时：

1. 读取主类字节码
2. 收集相关内部类字节码
3. 调用 CFR 反编译
4. 将结果作为可编辑 Java 文本展示

### 编译

保存 `.class` 时会调用 `javac`，并使用当前选择的 `Target` 作为 `-source` 与 `-target`。

### 空 `.class`

如果某个 `.class` entry 的内容长度为 `0`，扩展不会尝试反编译，而是直接按空文本打开。

## Java 工具查找顺序

编译和反编译都复用同一套 Java 工具定位逻辑：

1. `jarEditor.javaHome`
2. `JAVA_HOME`
3. `PATH`

### 配置项

```json
"jarEditor.javaHome": ""
```

当该配置为空时，扩展会继续回退到 `JAVA_HOME` 或系统 `PATH`。

## 输出目录约定

假设原始 JAR 为：

```text
/path/to/a.jar
```

则相关输出路径为：

```text
/path/to/a_temp/jar_edit_out
/path/to/a_edited.jar
```

`Build Jar` 完成后，`_edited.jar` 会被删除，对应 temp 目录也会被清理。

## 命令

- `jarEditor.refresh`
- `jarEditor.openClass`
- `jarEditor.addEntry`
- `jarEditor.deleteEntry`

## 项目结构

```text
src/
├── extension.ts
├── jarScanner.ts
├── jarModel.ts
├── jarExplorerProvider.ts
├── jarFileSystemProvider.ts
├── decompileContentProvider.ts
├── jarEditorToolProvider.ts
├── jarEditService.ts
├── javaDecompiler.ts
└── utils.ts
```

## 常用命令

```bash
npm install
npm run build
npm run watch
npm run compile
```

## 文档

更多实现细节见 `doc/`：

- `doc/plan.md`
- `doc/decompile-plan.md`
- `doc/editable-toolbar-plan.md`
- `doc/explorer-context-menu-plan.md`

## License

本项目采用仓库中的 [LICENSE](./LICENSE)。
