# AGENTS.md — JAR Editor VSCode 扩展

## 项目概述

这是一个 VSCode 扩展，用于在 Explorer 侧边栏中浏览工作区内的 JAR 内容，并支持对 JAR 内条目进行查看、反编译、编辑、重新编译、增删 entry 和回写。

当前能力包括：

- 自动扫描工作区中的 `*.jar`
- 在 `jarEditor` 树视图中展示 JAR 内目录结构
- 普通条目通过 `jar-contents:` 打开
- `.class` 条目通过 CFR 反编译为 Java 源码后打开
- 所有打开条目都可在自定义编辑器中修改
- `.class` 保存时会重新编译并写入编辑输出目录
- `Build Jar` 会将编辑产物合并回原始 JAR
- Explorer 右键支持 `Add` 和 `Delete`
- 新增的空 `.class` 文件可直接以空文本打开

## 技术栈

- 语言：TypeScript
- 运行时：Node.js / VSCode Extension Host
- 构建：esbuild（`esbuild.js`）
- ZIP 处理：`adm-zip`
- 反编译：CFR（`decompilers/cfr.jar`）
- 目标平台：VSCode `^1.85.0`

## 当前目录结构

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

doc/
├── plan.md
├── decompile-plan.md
├── editable-toolbar-plan.md
└── explorer-context-menu-plan.md
```

各模块职责：

- `extension.ts`：扩展入口，注册 Provider、命令、右键菜单行为、标签恢复与缓存刷新逻辑
- `jarScanner.ts`：扫描工作区中的 JAR，并监听新增、删除、变化
- `jarModel.ts`：读取 JAR、构建树、读取 entry、提取内部类
- `jarExplorerProvider.ts`：渲染 `jarEditor` 树视图，并为右键菜单提供 `contextValue`
- `jarFileSystemProvider.ts`：提供 `jar-contents:` scheme 内容，并缓存已打开 class 的文本
- `decompileContentProvider.ts`：提供 `jar-decompiled:` scheme 文本内容
- `jarEditorToolProvider.ts`：自定义编辑器、底部工具栏、Java 高亮、Target 下拉
- `jarEditService.ts`：保存条目、编译 `.class`、直接修改 JAR、构建并回写 JAR
- `javaDecompiler.ts`：定位 Java 工具、调用 CFR、处理反编译缓存
- `utils.ts`：URI 解析与输出路径辅助函数

## 核心概念

### 视图与命令

- 视图 ID：`jarEditor`
- 自定义编辑器 View Type：`jarEditor.textEditor`
- 当前命令：
  - `jarEditor.refresh`
  - `jarEditor.openClass`
  - `jarEditor.addEntry`
  - `jarEditor.deleteEntry`

### URI Scheme

- 原始内容：`jar-contents:///absolute/path/to/file.jar!/path/inside.jar`
- 反编译内容：`jar-decompiled:///absolute/path/to/file.jar!/path/inside.jar`

统一使用 `!/` 分隔外部 JAR 路径和内部 entry 路径。

### 输出目录

假设原始 JAR 为：

```text
/path/to/a.jar
```

则编辑输出目录和临时重建文件为：

```text
/path/to/a_temp/jar_edit_out
/path/to/a_edited.jar
```

`Build Jar` 完成后会删除 `_edited.jar`，并清理对应 temp 根目录。

## 当前行为细节

### 树视图

- JAR 根节点 `contextValue` 为 `jarRoot`
- 目录节点 `contextValue` 为 `jarDirectory`
- 文件节点 `contextValue` 为 `jarFile`
- 目录节点排在文件节点前，各自按字母排序
- 内部类 `.class` 不在树中直接展示
- `Add` 和 `Delete` 目前是右键菜单文字项，不使用自定义图标

### Add 路径规则

- 输入值会先去掉首尾空白
- 路径分隔符统一转为 `/`
- 禁止空字符串
- 禁止绝对路径
- 禁止 `.` 和 `..` 段
- 允许输入 `nested/path/A.class`
- 若目标已存在，直接报错，不覆盖

### Delete 行为规则

- 支持删除单个文件
- 支持删除整个目录及其所有子 entry
- 不支持删除 JAR 根节点
- 删除实现基于原始 `AdmZip` 对象删除匹配 entry 后整体写回
- 不要再回退到“逐个 `getData()` 复制旧 entry 再重建 ZIP”的实现，某些 JAR 会触发 `ADM-ZIP: No descriptor present`

### 当前 `.class` 保存行为

#### Target 选择

- `Target` 下拉仅对 `.class` 条目显示
- 可选 target 根据本机 `javac` 版本生成
- 默认值优先取当前 class 文件本身的字节码版本
- 如果无法解析 class 版本，则回退到本机 `javac` 支持的最高 target

#### 当前 `javac` 参数

固定参数：

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

Classpath 规则：

- 若 `jar_edit_out` 已存在：`<jar_edit_out>:<jarPath>`
- 否则：`<jarPath>`

## 开发约定

- 代码和代码注释使用英文
- 文档可使用中文
- `adm-zip` 使用默认导入：`import AdmZip from 'adm-zip'`
- 打包输出为单文件 `dist/extension.js`
- 右键菜单功能优先使用 `package.json` 的 `view/item/context`
- 右键弹出菜单本身不依赖命令图标；不要为该菜单强行维护一套无效图标资源

## 文档约定

- 计划和实现说明文档统一放在 `doc/` 目录下
- 文件名优先使用 `*-plan.md`，名称应直接描述主题，例如 `decompile-plan.md`
- 文档内容使用中文，代码、路径、命令、标识符保持原样并使用反引号包裹
- 文档应描述“当前实际实现”或“明确的实现计划”，不要写空泛目标或过期设想
- 推荐结构按主题选择，一般包含：
  - 标题
  - `## 当前状态`
  - `## 运行流程` / `## Add 流程` / `## Delete 流程` 这类行为章节
  - `## 主要文件`
  - `## 验证方式`
- 涉及行为说明时，优先写用户可见行为、数据流、缓存处理和失败分支
- 涉及实现说明时，优先列出关键文件及职责，不要求展开成逐文件变更清单
- `## 主要文件` 章节优先使用 Markdown 表格，按“文件 | 说明”组织
- `## 验证方式` 章节优先使用编号列表，写可直接执行的验证步骤
- 文档应与当前代码保持一致；功能行为变更后，如已有相关 `doc/*.md`，需要同步更新

## README约定
- 名字叫JarEditor，不要乱改大小写和增加空格
- 默认英文，还有一份README_zh.md为中文，README中可以自由切换中英文
- 只需要生成基本描述、功能特性、使用说明、安装与运行、LICENCE即可
-安装和运行包含两种:
  1. 通过VSCode Marketplace安装 
  2. 本地源码构建
- 尽可能保持简单，不要写技术和实现细节，主要突出功能和使用
- 使用说明需要用到img目录下的JarEditor_main.png和JarEditor_add_delete.png，使用img标签
 - JarEditor_main.png的width为800,height根据图片大小等比例调整
 - JarEditor_add_delete.png的width为500，height根据图片大小等比例调整

## 常用命令

```bash
npm install
npm run build
npm run watch
npm run compile
```

## 调试方式

- 在 VSCode 中按 `F5` 启动 Extension Development Host
- 重点验证 Explorer 右键菜单时，建议直接在 Extension Host 中用真实 JAR 点击测试

## 修改代码时应注意

- 涉及 `.class` 打开流程时，同时关注 `extension.ts`、`jarModel.ts`、`javaDecompiler.ts`、`jarFileSystemProvider.ts`
- 涉及保存/构建流程时，同时关注 `jarEditorToolProvider.ts`、`jarEditService.ts`、`utils.ts`
- 涉及 Explorer 右键菜单时，同时关注 `package.json`、`jarExplorerProvider.ts`、`extension.ts`
- 修改树节点展示逻辑时，注意保持“目录优先、字母排序、隐藏内部类”的行为一致
- 修改 URI 行为时，确保 `create*Uri` 与 `parse*Uri` 成对更新
- 变更 JAR 或 class 打开缓存逻辑时，注意 scanner 的变更回调和标签恢复逻辑
- 修改 `.class` 反编译缓存时，要确认空字符串缓存不会被误判为“无内容”
- 修改 JAR 删除逻辑时，优先沿用当前 `AdmZip.deleteFile(...) + writeZip(...)` 的做法

## 验证建议

1. 运行 `npm run compile`
2. 必要时运行 `npm run build`
3. 在 VSCode 中按 `F5` 启动 Extension Host
4. 确认 `jarEditor` 视图能列出工作区中的 JAR 文件
5. 打开普通文本条目，确认可编辑内容正常显示
6. 打开 `.class` 条目，确认显示反编译后的 Java 源码
7. 新增空 `.class` 文件，确认可以以空文本打开
8. 右键执行 `Add` / `Delete`，确认树和标签页状态正确刷新
9. 保存修改后的 class，确认 `jar_edit_out` 中生成新的编译产物
10. 执行 `Build Jar`，确认原始 JAR 被更新

