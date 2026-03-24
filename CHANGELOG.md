# Changelog

All notable changes to JarEditor will be documented in this file.

## 1.0.1

- Fixed Windows URI handling for JAR entries so files inside JARs can be opened correctly.
- Fixed Windows save/compile failures caused by overly long `javac` classpaths.
- Reduced compile classpath length by compacting JAR directories and passing the result through the spawned `javac` process environment.

## 1.0.0

- Initial release of JarEditor.
- Browse workspace JAR files from the Explorer sidebar.
- Open and edit regular JAR entries directly in VS Code.
- Open `.class` files as decompiled Java source and recompile them on save.
- Add or delete entries inside a JAR and build edited output back into the original archive.
