# JarEditor

本扩展基于VSCode，如基于Jetbrains可看我另一个项目：https://github.com/Liubsyy/JarEditor

[English](./README.md) | [中文](./README_zh.md)

JarEditor 是一个 VS Code 扩展，用于直接在 Explorer 中浏览和编辑 JAR 文件。

它适合常见的 JAR 修改流程：查看归档内容、编辑文本资源、把 `.class` 反编译为 Java 源码、保存后重新编译，并最终将修改写回原始 JAR。

![JarEditor demo](./img/JarEditor_demo.gif)

## 功能特性

- 在 `JarEditor` 视图中浏览 JAR 内容
- 直接打开和编辑 JAR 内的文本条目
- 将 `.class` 条目以反编译后的 Java 源码打开
- 保存修改后的 `.class` 时自动重新编译
- 在 Explorer 中新增文件、类和目录
- 删除 JAR 内的文件或目录
- 将编辑结果重新构建回原始归档

## 使用说明

1. 打开一个包含 JAR 文件的工作区。
2. 在 Explorer 中找到 `JarEditor` 视图。
3. 展开目标 JAR，打开需要查看或编辑的条目。
4. 修改并保存 `.class` 条目后会触发重新编译。
5. 使用 `Build Jar` 将编辑结果合并回原始 JAR。

如果需要编辑 `.class` 文件，请确保本机存在可用的 JDK。你可以通过 `jarEditor.javaHome` 配置，或在编辑器工具栏中选择 JDK。

<img src="./img/JarEditor_main.png" alt="JarEditor 主视图" />

也可以通过 Explorer 右键菜单新增文件、类、目录，或者删除已有条目。

<img src="./img/JarEditor_add_delete.png" width="500" alt="JarEditor 新增和删除" />

## 安装与运行

### 通过 VSCode Marketplace 安装

在 VS Code 的 Extensions 视图中搜索 `JarEditor` 并安装。

### 本地源码构建

```bash
npm install
npm run build
```

使用 VS Code 打开当前项目后，按 `F5` 启动 Extension Development Host。

## Licence

本项目基于 [Apache License 2.0](./LICENSE) 发布。
