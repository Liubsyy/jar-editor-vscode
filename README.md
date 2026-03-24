# JarEditor

[English](./README.md) | [中文](./README_zh.md)

JarEditor is a VS Code extension for browsing and editing JAR files directly from the Explorer sidebar.

It lets you inspect archive contents, edit regular entries, open `.class` files as decompiled Java source, add or delete entries, and write changes back to the original JAR.

## Features

- Browse JAR files in the `JarEditor` view
- Open and edit regular files inside a JAR
- Open `.class` files as decompiled Java source
- Recompile modified `.class` files on save
- Add new files, classes, and directories
- Delete files or directories from a JAR
- Build edited output back into the original JAR

## Usage

Open a workspace that contains JAR files. JarEditor will list them in the Explorer sidebar.

Open any regular entry to edit its text content directly. Open a `.class` entry to view and edit decompiled Java source in the custom editor. After saving Java changes, use `Build Jar` to merge the compiled output back into the original archive.

If you want to edit `.class` files, make sure a JDK is available. You can use `jarEditor.javaHome` or select a JDK from the editor toolbar.

<img src="./img/JarEditor_main.png" width="800" height="472" alt="JarEditor main view" />

Use the Explorer context menu to create files, classes, or directories, and delete existing entries when needed.

<img src="./img/JarEditor_add_delete.png" width="500" height="431" alt="JarEditor add and delete actions" />

## Installation and Running

### Install from VS Code Marketplace

Open the Extensions view in VS Code, search for `JarEditor`, and install it from the Marketplace.

### Build from Source

```bash
npm install
npm run build
```

Open this project in VS Code and press `F5` to start an Extension Development Host.

## Licence

Released under the [Apache License 2.0](./LICENSE).
