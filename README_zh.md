# JarEditor

[English](./README.md) | [中文](./README_zh.md)

JarEditor 是一个 VS Code 扩展，用于直接在 Explorer 中浏览和编辑 JAR 文件。

它支持查看归档内容、编辑普通文本条目、将 `.class` 以反编译后的 Java 源码打开、增删条目，并将修改重新构建回原始 JAR。

![JarEditor demo](./img/JarEditor_demo.gif)

## 功能特性

- 在 Explorer 的 `JarEditor` 视图中浏览 JAR 内容
- 直接打开和编辑 JAR 内的普通文本文件
- 将 `.class` 文件以反编译后的 Java 源码打开
- 保存修改后的 `.class` 时自动重新编译
- 通过右键菜单新增文件、类和目录
- 删除 JAR 内的文件或目录
- 将编辑产物重新构建回原始归档

## 使用说明

1. 打开一个包含 JAR 文件的工作区。
2. 在 Explorer 中找到 `JarEditor` 视图。
3. 打开任意条目进行查看或编辑。
4. 保存 `.class` 修改后会触发重新编译。
5. 使用 `Build Jar` 将编译结果合并回原始 JAR。

如果需要编辑 `.class` 文件，请确保本机存在可用的 JDK。你可以通过 `jarEditor.javaHome` 配置，或在编辑器工具栏中选择 JDK。

<img src="./img/JarEditor_main.png" width="800" height="472" alt="JarEditor 主视图" />

你也可以通过 Explorer 右键菜单在 JAR 内新增文件、类或目录，并删除已有条目。

<img src="./img/JarEditor_add_delete.png" width="500" height="431" alt="JarEditor 新增和删除" />

## 安装与运行

### 通过 VS Code Marketplace 安装

在 VS Code 的 Extensions 视图中搜索 `JarEditor` 并安装。

### 本地源码构建

```bash
npm install
npm run build
```

使用 VS Code 打开当前项目后，按 `F5` 启动 Extension Development Host。

## Licence

本项目基于 [Apache License 2.0](./LICENSE) 发布。
