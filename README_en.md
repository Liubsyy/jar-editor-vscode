# JAR Editor

[中文](./README.md) | [English](./README_en.md)

A VSCode extension for browsing and editing JAR files.

It scans JAR files in the current workspace, shows their internal tree structure in the Explorer sidebar, and supports viewing, editing, decompiling, recompiling, and directly modifying JAR entries.

## Features

- Automatically scans `*.jar` files in the workspace
- Shows a JAR tree in the `jarEditor` view
- Opens and edits regular entries directly
- Decompiles `.class` entries with CFR before opening them
- Provides a custom editor with `Save` and `Build Jar`
- Recompiles `.class` entries with `javac` on save
- Adds `Add` and `Delete` to the Explorer context menu
- Supports adding empty files directly into the original JAR
- Supports deleting a single entry or an entire directory recursively
- Opens empty `.class` entries as empty text so you can start typing Java source immediately

## Setup

### Requirements

- Node.js
- VSCode `^1.85.0`
- A working Java environment if you want to decompile or compile `.class` files

### Install dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Compile for development

```bash
npm run compile
```

### Debug

Press `F5` in VSCode to launch the Extension Development Host.

## Usage

### Browse JAR files

After activation, JAR files in the workspace appear in the `JAR Editor` view in the Explorer sidebar.

Tree behavior:

- Directories are listed before files
- Siblings are sorted alphabetically
- Inner `.class` files containing `$` in the filename are hidden by default

### Open files

- Non-`.class` files are opened through `jar-contents:`
- `.class` files trigger `jarEditor.openClass`, are decompiled first, and then opened

### Edit and save

All opened entries use the custom editor `jarEditor.textEditor`.

- Saving a regular text entry writes content to `<jarBase>_temp/jar_edit_out`
- Saving a `.class` entry treats the current text as Java source and recompiles it
- `Build Jar` merges artifacts from `jar_edit_out` back into the original JAR

### Context menu

The Explorer context menu supports:

- JAR root: `Add`
- Directory: `Add`, `Delete`
- File: `Delete`

#### Add

- Opens an input box
- Accepts a relative path based on the current node, such as `a.txt` or `nested/path/A.class`
- Writes an empty file directly into the original JAR

#### Delete

- Deletes a single file or all entries under a directory recursively
- Shows a confirmation dialog before deletion
- Rewrites the original JAR after deletion

## `.class` handling

### Decompilation

The extension uses the bundled CFR jar:

```text
decompilers/cfr.jar
```

When opening a `.class` entry:

1. It reads the main class bytes
2. It collects related inner class bytes
3. It runs CFR
4. It shows the result as editable Java text

### Compilation

Saving a `.class` entry runs `javac` and uses the selected `Target` as both `-source` and `-target`.

### Empty `.class` entries

If a `.class` entry has zero bytes, the extension does not try to decompile it. It opens it as empty text instead.

## Java tool lookup order

The extension uses the same lookup logic for both compilation and decompilation:

1. `jarEditor.javaHome`
2. `JAVA_HOME`
3. `PATH`

### Configuration

```json
"jarEditor.javaHome": ""
```

If the setting is empty, the extension falls back to `JAVA_HOME` and then the system `PATH`.

## Output paths

If the original JAR is:

```text
/path/to/a.jar
```

Then the generated paths are:

```text
/path/to/a_temp/jar_edit_out
/path/to/a_edited.jar
```

After `Build Jar`, `_edited.jar` is removed and the temp directory is cleaned up.

## Commands

- `jarEditor.refresh`
- `jarEditor.openClass`
- `jarEditor.addEntry`
- `jarEditor.deleteEntry`

## Project structure

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

## Common commands

```bash
npm install
npm run build
npm run watch
npm run compile
```

## Docs

More implementation details are available in `doc/`:

- `doc/plan.md`
- `doc/decompile-plan.md`
- `doc/editable-toolbar-plan.md`
- `doc/explorer-context-menu-plan.md`

## License

This project uses the repository [LICENSE](./LICENSE).
