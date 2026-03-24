# JarEditor

[English](./README.md) | [中文](./README_zh.md)

JarEditor 是一个 VS Code 扩展，用于在 Explorer 侧边栏中直接浏览和编辑 JAR 文件。

它可以查看归档内容、编辑普通条目、将 `.class` 以反编译后的 Java 源码打开、增删 JAR 内条目，并将修改重新写回原始 JAR。

## 功能特性

- 在 `JarEditor` 视图中浏览 JAR 文件
- 直接打开和编辑 JAR 内的普通文件
- 将 `.class` 文件以反编译后的 Java 源码打开
- 保存后自动重新编译已修改的 `.class`
- 支持新建文件、类和目录
- 支持删除 JAR 内的文件或目录
- 支持将编辑结果重新构建回原始 JAR

## 使用说明

打开一个包含 JAR 文件的工作区后，JarEditor 会在 Explorer 侧边栏中列出这些 JAR。

普通条目会直接以文本方式打开并可编辑，`.class` 条目会在自定义编辑器中以反编译后的 Java 源码打开。保存 Java 修改后，可以使用 `Build Jar` 将编译结果合并回原始归档。

如果需要编辑 `.class` 文件，请确保本机存在可用的 JDK。你可以通过 `jarEditor.javaHome` 配置，或在编辑器工具栏中选择 JDK。

<img src="./img/JarEditor_main.png" width="800" height="472" alt="JarEditor 主界面" />

你也可以通过 Explorer 右键菜单在 JAR 内新建文件、类或目录，并删除已有条目。

<img src="./img/JarEditor_add_delete.png" width="500" height="431" alt="JarEditor 新增和删除" />

## 安装与运行

### 通过 VS Code Marketplace 安装

在 VS Code 的 Extensions 视图中搜索 `JarEditor`，然后从 Marketplace 安装。

### 本地源码构建

```bash
npm install
npm run build
```

使用 VS Code 打开当前项目后，按 `F5` 启动 Extension Development Host。

## Licence

本项目基于 [Apache License 2.0](./LICENSE) 发布。
