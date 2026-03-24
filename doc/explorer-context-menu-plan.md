# JAR Explorer Add / Delete 菜单

## 当前状态

`jarEditor` Explorer 视图已经支持对树节点使用右键菜单进行 `Add` 和 `Delete` 操作。

- JAR 根节点显示 `Add`
- 目录节点显示 `Add` 和 `Delete`
- 文件节点显示 `Delete`
- 操作会直接修改原始 JAR，不依赖 `jar_edit_out` 或 `Build Jar`

## Add 流程

### 菜单显示规则

- JAR 根节点右键显示 `Add`
- 目录节点右键显示 `Add`
- 文件节点不显示 `Add`

### 行为

执行 `Add` 时：

1. 弹出输入框
2. 输入值按“相对于当前节点”的相对路径处理
3. 允许输入如 `a.txt` 或 `nested/path/A.class`
4. 校验通过后，直接向原始 JAR 写入一个空文件
5. 清理缓存、关闭受影响标签页并刷新树

### 路径规则

- 输入值会先去掉首尾空白
- 路径分隔符统一转为 `/`
- 禁止空字符串
- 禁止绝对路径
- 禁止 `.` 和 `..` 段
- 如果目标 entry 已存在，则直接报错，不覆盖

## Delete 流程

### 菜单显示规则

- 目录节点右键显示 `Delete`
- 文件节点右键显示 `Delete`
- JAR 根节点不显示 `Delete`

### 行为

执行 `Delete` 时：

1. 弹出确认框
2. 文件删除时，删除单个 entry
3. 目录删除时，按目录前缀递归删除其下所有 entry
4. 使用 `adm-zip` 直接在原 ZIP 对象上删除匹配条目
5. 生成临时 `_edited.jar` 后覆盖原始 JAR
6. 清理缓存、关闭受影响标签页并刷新树

## `.class` 特殊处理

- 新增的空 `.class` 文件允许直接打开
- 如果 `.class` 字节内容长度为 `0`，则默认按空文本处理
- 这种情况下不会尝试调用 CFR 反编译
- 打开后的编辑器显示为空白文本，可直接输入 Java 源码并保存

## 缓存与视图刷新

新增或删除后，会统一做以下处理：

1. 关闭受影响的已打开标签页
2. 清理 `JarFileSystemProvider` 中该 JAR 的内存修改缓存
3. 清理 class 文本缓存目录
4. 关闭 `JarModel` 中该 JAR 的旧实例
5. 清理 `JavaDecompiler` 内存缓存
6. 重新扫描工作区并刷新 Explorer 树

这样可以避免删除后仍显示旧内容，或新增后打开到旧缓存的问题。

## 主要文件

| 文件 | 说明 |
|------|------|
| `src/extension.ts` | 注册 `jarEditor.addEntry` / `jarEditor.deleteEntry` 命令，并串联确认、刷新、关闭标签页逻辑 |
| `src/jarExplorerProvider.ts` | 为树节点设置 `contextValue`，决定右键菜单显示范围 |
| `src/jarEditService.ts` | 新增空文件写入和 entry 删除能力，直接回写原始 JAR |
| `src/jarFileSystemProvider.ts` | 清理已打开内容缓存和 class 缓存 |
| `package.json` | 注册命令并在 `view/item/context` 中声明右键菜单项 |

## 验证方式

1. 在 JAR 根节点右键，确认能看到 `Add`
2. 在目录节点右键，确认能看到 `Add` 和 `Delete`
3. 在文件节点右键，确认能看到 `Delete`
4. 在根节点新增 `a.txt`，确认立即出现在树中
5. 在目录节点新增 `nested/A.class`，确认可以打开，且空 `.class` 显示为空文本
6. 删除单个文件，确认树中消失且无法再次打开
7. 删除目录，确认整个目录子树被移除
8. 重复刷新或重新打开 JAR，确认不会出现旧缓存残留
