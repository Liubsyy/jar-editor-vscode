# JarEditor

[English](./README.md) | [中文](./README_zh.md)

`JarEditor` 是一个 VS Code 扩展，用于在 Explorer 侧边栏中直接浏览和编辑 JAR 文件。

它支持查看归档内容、以文本方式编辑普通条目、将 `.class` 以反编译后的 Java 源码打开，并支持新增、删除条目以及将修改重新构建回原始 JAR。

## 功能特性

- 在 `JarEditor` 视图中浏览工作区里的 JAR 文件
- 直接打开和编辑 JAR 内的普通文件
- 将 `.class` 文件以反编译后的 Java 源码形式打开
- 保存后自动重新编译已修改的 `.class`
- 支持在 JAR 内新建文件、类和目录
- 支持删除 JAR 内的文件或目录
- 支持将编辑结果构建回原始 JAR

## 使用说明

打开一个包含 JAR 文件的工作区后，可以在 Explorer 侧边栏的 `JarEditor` 视图中浏览归档结构。

普通条目可直接在 VS Code 中编辑，`.class` 条目会在自定义编辑器中以反编译后的 Java 源码打开。保存后，JarEditor 会重新编译源码，并将结果保留到 `Build Jar` 时统一写回。

如果需要编辑 `.class` 文件，请确保本机存在可用的 JDK。你可以通过 `jarEditor.javaHome` 配置，或在编辑器工具栏中选择 JDK。

<img src="./img/JarEditor_main.png" width="800" height="472" alt="JarEditor 主界面" />

你也可以通过 Explorer 右键菜单在 JAR 内新建文件、类或目录，并删除已有条目。

<img src="./img/JarEditor_add_delete.png" width="600" height="517" alt="JarEditor 新增和删除" />

## 安装与运行

### 通过 VS Code Marketplace 安装

在 VS Code 的 Extensions 视图中搜索 `JarEditor`，然后从 Marketplace 安装。

### 本地源码构建

```bash
npm install
npm run compile
```

使用 VS Code 打开当前项目后，按 `F5` 启动 Extension Development Host。

## Licence

本项目基于 [Apache License 2.0](./LICENSE) 发布。
