# Spring Boot JAR 编译支持

## 当前状态

当保存位于 `BOOT-INF/classes/...` 下的 `.class` 条目时，扩展会进入 Spring Boot 编译模式。

- `BOOT-INF/classes/**` 会提取到 `<jarBase>_temp/dependency_temp/classes`
- `BOOT-INF/lib/*.jar` 会复制到 `<jarBase>_temp/dependency_temp/lib`
- `javac` 会把这些目录和 JAR 作为编译时 classpath
- 编译产物会写回 `<jarBase>_temp/jar_edit_out/BOOT-INF/classes/...`

非 Spring Boot JAR 或不在 `BOOT-INF/classes/` 下的 `.class` 条目，仍保持原有保存行为。

## Save 流程

### 标准 JAR

1. 将当前编辑内容视为 Java 源码
2. 生成临时 `.java` 文件
3. 使用原有 classpath 规则调用 `javac`
4. 将生成的 `.class` 文件复制到 `jar_edit_out`

### Spring Boot JAR

1. 识别 entry 路径是否以 `BOOT-INF/classes/` 开头
2. 清理并重建 `<jarBase>_temp/dependency_temp`
3. 从原始 JAR 提取 `BOOT-INF/classes/**` 到 `dependency_temp/classes`
4. 将 `BOOT-INF/lib/*.jar` 复制到 `dependency_temp/lib`
5. 组装 Spring Boot 专用 classpath 并调用 `javac`
6. 将生成的主类和内部类复制到 `jar_edit_out/BOOT-INF/classes/...`

## classpath 规则

Spring Boot 模式下的 classpath 顺序如下：

1. `<jarBase>_temp/jar_edit_out/BOOT-INF/classes`，如果已存在
2. `<jarBase>_temp/dependency_temp/classes`
3. `<jarBase>_temp/dependency_temp/lib` 下所有 `*.jar`
4. 原始 `<jarPath>` 作为兜底项

其中：

- `BOOT-INF/lib` 下的嵌套依赖 JAR 只复制，不解压
- `dependency_temp/lib` 下的 JAR 按文件名字母序加入 classpath

## Build Jar 行为

执行 `Build Jar` 时：

1. 读取 `jar_edit_out` 下的所有产物
2. 保留 `BOOT-INF/classes/...` 的相对路径写回原始 JAR
3. 删除整个 `<jarBase>_temp`

因此 `dependency_temp` 也会在 `Build Jar` 后一起清理。

## 主要文件

| 文件 | 说明 |
|------|------|
| `src/jarEditService.ts` | Spring Boot 编译模式识别、依赖准备、classpath 组装、产物回写 |
| `src/utils.ts` | `dependency_temp`、`classes`、`lib` 路径辅助函数 |

## 验证方式

1. 打开一个普通 JAR 的 `.class` 条目并保存，确认行为与原来一致
2. 打开一个 Spring Boot JAR 中的 `BOOT-INF/classes/...` 条目并保存
3. 确认 `<jarBase>_temp/dependency_temp/classes` 下出现提取出的 classes
4. 确认 `<jarBase>_temp/dependency_temp/lib` 下出现复制出的依赖 JAR
5. 确认 `<jarBase>_temp/jar_edit_out/BOOT-INF/classes/...` 下生成新的 `.class`
6. 修改引用 `BOOT-INF/lib` 依赖类型的源码后再次保存，确认可成功编译
7. 执行 `Build Jar`，确认编译产物回写到原始 JAR 的 `BOOT-INF/classes/...`
