# JarEditor

This extension is based on VSCode. If you are looking for a JetBrains-based version, see my other project: https://github.com/Liubsyy/JarEditor

[English](./README.md) | [中文](./README_zh.md)

JarEditor is a VS Code extension for browsing and editing JAR files directly from Explorer.

It is built for the common workflow of inspecting archive contents, editing text resources, decompiling `.class` files into Java source, recompiling changes, and writing the result back into the original JAR.

![JarEditor demo](./img/JarEditor_demo.gif)

## Features

- Browse JAR contents in the `JarEditor` view
- Open and edit text entries inside a JAR
- Open `.class` entries as decompiled Java source
- Save modified `.class` files and recompile them
- Add new files, classes, or directories from Explorer
- Delete files or directories from a JAR
- Build edited output back into the original archive

## Usage

1. Open a workspace that contains JAR files.
2. Find the `JarEditor` view in Explorer.
3. Expand a JAR and open any entry you want to inspect or edit.
4. Save changes to a `.class` entry to trigger recompilation.
5. Use `Build Jar` to merge edited output back into the source JAR.

If you want to edit `.class` files, make sure a JDK is available. You can configure `jarEditor.javaHome`, or choose a JDK from the editor toolbar.

<img src="./img/JarEditor_main.png" alt="JarEditor main view" />

Use the Explorer context menu to add files, classes, directories, or delete existing entries.

<img src="./img/JarEditor_add_delete.png" width="500" alt="JarEditor add and delete actions" />

## Installation and Running

### Install from VSCode Marketplace

Search for `JarEditor` in the VS Code Extensions view and install it from the Marketplace.

### Build from Source

```bash
npm install
npm run build
```

Open this project in VS Code and press `F5` to launch an Extension Development Host.

## Licence

Released under the [Apache License 2.0](./LICENSE).
