# JarEditor

[English](./README.md) | [中文](./README_zh.md)

JarEditor is a VS Code extension for browsing and editing JAR files directly from the Explorer sidebar.

It lets you inspect archive contents, open regular entries as text, view `.class` files as decompiled Java source, add or delete entries, and build your changes back into the original JAR.

## Features

- Browse workspace JAR files in the `JarEditor` view
- Open and edit regular files inside a JAR
- Open `.class` files as decompiled Java source
- Recompile edited `.class` files on save
- Create files, classes, and directories inside a JAR
- Delete files or directories from a JAR
- Build edited output back into the original JAR

## Usage

Open a workspace that contains JAR files, then use the `JarEditor` view in Explorer to browse the archive structure.

Regular entries can be edited directly in VS Code. `.class` entries open as decompiled Java source in the custom editor. After saving, JarEditor recompiles the source and keeps the output ready for `Build Jar`.

If you edit `.class` files, make sure a JDK is available. You can set `jarEditor.javaHome` or choose a JDK from the editor toolbar.

<img src="./img/JarEditor_main.png" width="800" height="472" alt="JarEditor main view" />

Use the Explorer context menu to create new files, classes, or directories, and to delete existing entries from the JAR.

<img src="./img/JarEditor_add_delete.png" width="600" height="517" alt="JarEditor add and delete actions" />

## Installation and Running

### Install from VS Code Marketplace

Open the Extensions view in VS Code, search for `JarEditor`, and install it from the Marketplace.

### Build from Source

```bash
npm install
npm run compile
```

Open this project in VS Code and press `F5` to start an Extension Development Host.

## Licence

Released under the [Apache License 2.0](./LICENSE).
