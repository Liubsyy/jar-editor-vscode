# JAR Editor

[English](./README.md) | [中文](./README_zh.md)

`JAR Editor` 是一个 VS Code 扩展，用于在 Explorer 侧边栏中直接浏览和编辑 JAR 内容。

它可以扫描工作区中的 JAR，打开并编辑普通条目，将 `.class` 以反编译后的 Java 源码形式展示，并在完成修改后将结果重新构建回原始 JAR。

## 功能特性

- 自动发现当前工作区中的 `*.jar`
- 在 `JAR Editor` 视图中浏览 JAR 内容
- 直接打开并编辑普通条目
- 以反编译后的 Java 源码形式打开 `.class`
- 保存时重新编译已修改的 `.class`
- 通过右键菜单新建文件、类和目录
- 删除 JAR 内的文件或目录
- 将编辑产物构建回原始 JAR

## 使用说明

打开一个包含 JAR 文件的工作区后，可以在 Explorer 侧边栏的 `JAR Editor` 视图中浏览和编辑条目。

对于 `.class` 文件，扩展会打开反编译后的 Java 源码。修改并保存后，源码会重新编译并作为待构建产物保留；确认无误后，使用 `Build Jar` 即可将修改写回原始 JAR。

如果需要编辑 `.class` 文件，请确保本机有可用的 JDK。

![主界面](./img/JarEditor_main.png)

可以通过 Explorer 右键菜单在 JAR 内新建条目，或删除已有文件和目录。

![新增和删除](./img/JarEditor_add_delete.png)

## 安装与运行

### 通过 VS Code Marketplace 安装

在 VS Code 的 Extensions 视图中搜索 `JAR Editor`，然后从 Marketplace 安装。

### 通过源码构建运行

```bash
npm install
npm run compile
```

使用 VS Code 打开当前项目后，按 `F5` 启动 Extension Development Host。

## License

本项目基于 [Apache License 2.0](./LICENSE) 发布。
