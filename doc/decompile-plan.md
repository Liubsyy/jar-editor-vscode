# JAR 内 `.class` 文件反编译流程

## 当前状态

`.class` 条目不再以二进制乱码形式打开，而是通过 `jarEditor.openClass` 命令先反编译，再在自定义 webview 编辑器中以 Java 源码形式展示。

## 运行流程

1. Explorer 树中会隐藏文件名包含 `$` 的内部类 `.class`
2. 点击可见的 `.class` 条目时，触发 `jarEditor.openClass`
3. 模型层读取主类字节码和对应的内部类字节码
4. `JavaDecompiler` 将这些 class 布局写入临时目录并调用 CFR
5. 反编译结果写入内存文件系统
6. 最终通过 `JarEditorToolProvider` 打开为可编辑文档

## 反编译细节

- 反编译器：内置 CFR JAR
- 调用方式：`java -jar <cfr.jar> <classFile>`
- Java 可执行文件查找通过 `findJavaToolExecutable('java' | 'javac')` 统一处理
- 查找优先级：
  1. `jarEditor.javaHome`
  2. `JAVA_HOME`
  3. `PATH`

## 反编译后编辑器行为

- 反编译得到的 Java 源码可以继续编辑
- Java 语法高亮由 webview 内部实现
- 工具栏包含 `Save`、`Build Jar` 和 `Target`
- 保存 `.class` 时不会直接保存反编译文本，而是重新编译为 `.class` 文件

## 缓存与降级

- 反编译结果按 `jarPath + entryPath` 进行内存缓存
- JAR 发生变化时，相关缓存需要随扫描/模型更新一起失效
- 如果 Java 环境不可用，反编译流程会返回可读的错误提示，而不是显示原始二进制

## 主要文件

| 文件 | 说明 |
|------|------|
| `src/javaDecompiler.ts` | CFR 调用、临时目录布局、Java 路径解析、缓存 |
| `src/jarModel.ts` | 读取主类字节码并收集内部类字节码 |
| `src/jarExplorerProvider.ts` | 将 `.class` 点击路由到 `jarEditor.openClass`，并隐藏 `$` 内部类 |
| `src/jarFileSystemProvider.ts` | 内存中保存并提供反编译后的内容 |
| `src/jarEditorToolProvider.ts` | 在自定义编辑器中展示反编译后的 Java 源码 |
| `src/extension.ts` | 注册 Provider 和 `jarEditor.openClass` 命令 |

## 验证方式

1. 打开一个包含 `.class` 文件的 JAR
2. 点击任意可见的 `.class` 条目
3. 确认编辑器中显示的是可读的 Java 源码，而不是二进制乱码
4. 确认 Java 语法高亮生效
5. 重复打开同一个类时，确认缓存生效、打开更快
6. 保存修改后的 `.class`，确认会走工具栏的重新编译流程
