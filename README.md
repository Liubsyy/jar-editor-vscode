# JAR Editor

[English](./README.md) | [中文](./README_zh.md)

JAR Editor is a VS Code extension for browsing and editing JAR contents directly from the Explorer sidebar.

It lets you inspect entries inside workspace JAR files, open regular files for editing, view `.class` files as decompiled Java source, and build your changes back into the original archive.

## Features

- Automatically discover `*.jar` files in the current workspace
- Browse JAR contents in the `JAR Editor` view
- Open and edit regular entries directly in VS Code
- Open `.class` entries as decompiled Java source
- Recompile modified `.class` files on save
- Create files, classes, and directories from the Explorer context menu
- Delete files or directories inside a JAR
- Build edited output back into the original JAR

## Usage

Open a workspace that contains one or more JAR files, then use the `JAR Editor` view in the Explorer sidebar to browse and edit entries.

For `.class` files, the extension opens decompiled Java source. After editing and saving, the source is recompiled and prepared for JAR rebuild. When you are ready, use `Build Jar` to write the edited result back to the original archive.

If you want to edit `.class` files, make sure a local JDK is available.

![Main View](./img/JarEditor_main.png)

Use the Explorer context menu to create new entries or remove existing ones inside the JAR.

![Add And Delete](./img/JarEditor_add_delete.png)

## Installation and Running

### Install from VS Code Marketplace

Open the Extensions view in VS Code, search for `JAR Editor`, and install it from the Marketplace.

### Build from Source

```bash
npm install
npm run compile
```

Open this project in VS Code, then press `F5` to launch an Extension Development Host.

## License

Licensed under the [Apache License 2.0](./LICENSE).
