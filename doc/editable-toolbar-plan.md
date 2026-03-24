# JAR 可编辑工具栏

## 当前状态

`JarEditorToolProvider` 已经提供了带底部工具栏的自定义编辑器。

- 所有打开的条目都可以在 webview 编辑器中直接编辑
- 工具栏包含 `Save` 和 `Build Jar`
- 对于 `.class` 条目，工具栏还会显示 `Target` 下拉框
- 编辑器会维护当前内存中的文本，输入时不会反复重建整个 webview

## Save 流程

### 非 `.class` 条目

保存普通文本条目时：

1. 计算 `<jarBase>_temp/jar_edit_out/<entryPath>`
2. 按需创建父目录
3. 将当前文本按 UTF-8 写入目标路径

### `.class` 条目

保存 `.class` 条目时：

1. 将当前编辑内容视为 Java 源码
2. 根据源码中的 `package` 推导临时 `.java` 文件路径
3. 调用 `javac` 编译
4. 将生成的 `.class` 文件复制到 `jar_edit_out`
5. 在复制新产物之前，先删除同名主类和内部类的旧编译结果

如果编译生成了 `Foo$Bar.class` 之类的内部类文件，也会和主类一起写入输出目录。

## Target 选择逻辑

`Target` 下拉框仅在 `.class` 条目中显示。

- 可选项根据本机 `javac` 版本动态生成
- `Java 1.1` 到 `Java 1.8` 始终显示
- `Java 9+` 会一直列到当前检测到的本机 `javac` 特性版本上限
- 默认选中值优先取当前打开 `.class` 文件本身的字节码版本
- 如果无法解析 class 版本，则回退到当前本机 `javac` 支持的最高 target

class 版本解析顺序如下：

1. 先检查 `jar_edit_out` 中是否已有该条目的已编辑 `.class`
2. 如果没有，再读取原始 JAR 内的 `.class` 条目

## 当前 javac 参数

当前 Save 时传给 `javac` 的参数如下：

```bash
-encoding UTF-8
-Xlint:none
-g
-source <target>
-target <target>
-cp <classpath>
-d <classesRoot>
```

条件参数：

- Java 8 及以上追加 `-parameters`
- Java 6 及以上追加 `-proc:none`

classpath 规则：

- 如果 `jar_edit_out` 已存在，则 classpath 为 `<jar_edit_out>:<jarPath>`
- 否则 classpath 为 `<jarPath>`

当前 `javac` 进程环境还会额外注入：

```bash
JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8 -Duser.language=en
```

## Build Jar 流程

点击 `Build Jar` 时：

1. 使用 `adm-zip` 加载原始 JAR
2. 读取 `jar_edit_out` 下的所有文件
3. 对已存在的同名 entry 执行覆盖，不存在的则新增
4. 先写出 `<jarBase>_edited.jar`
5. 再将 `<jarBase>_edited.jar` 覆盖回原始 JAR
6. 删除 `<jarBase>_edited.jar`
7. 删除该 JAR 对应的 temp 根目录

如果当前没有任何编辑产物，`Build Jar` 会返回 `Nothing modified`。

## 主要文件

| 文件 | 说明 |
|------|------|
| `src/jarEditorToolProvider.ts` | webview 编辑器、工具栏 UI、Target 下拉、Save / Build Jar 入口 |
| `src/jarEditService.ts` | 保存文本条目、编译 class 条目、重建 JAR |
| `src/utils.ts` | 输出目录与 `_edited.jar` 路径辅助函数 |
| `src/javaDecompiler.ts` | 共享 Java / Javac 可执行文件定位逻辑 |

## 验证方式

1. 打开一个普通文本条目并点击 `Save`
2. 确认 `<jarBase>_temp/jar_edit_out` 下生成对应文件
3. 打开一个 `.class` 条目，确认工具栏显示 `Target`
4. 确认默认选中的 target 与当前 class 文件版本一致
5. 保存 `.class` 条目，确认新的 `.class` 编译产物写入 `jar_edit_out`
6. 点击 `Build Jar`，确认原始 JAR 被原地更新
