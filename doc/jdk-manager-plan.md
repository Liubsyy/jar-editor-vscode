# JDK 管理方案

## 当前状态

已实现。用户可以在自定义编辑器工具栏中管理和选择 JDK，选定的 JDK 用于 `.class` 文件的编译。

## 功能概述

### 工具栏 JDK 区域

仅在 `.class` 文件编辑器中显示，位于 Target 下拉框左侧，包含：

- **JDK 超链接**：蓝色文字，hover 显示下划线和手型光标，点击弹出 JDK 管理对话框
- **JDK 下拉框**：列出 Default + 用户添加的 JDK，宽度限制 80–140px

布局顺序：`[JDK] [JDK 下拉框] [Target] [Target 下拉框] [Save] [Build Jar]`

### JDK 管理对话框

在编辑器 webview 内以**模态遮罩层**形式弹出（非新标签页），UI 参考 IntelliJ SDK List：

- 左侧：JDK 列表，`+` / `−` 按钮增删
- 右侧：Name 和 JDK Home 字段，Home 旁有文件夹选择按钮
- 底部：Cancel / OK 按钮
- 点击遮罩外区域可关闭

### 默认 JDK

- JDK 下拉框始终包含一个 `Default (xxx)` 选项（xxx 为自动检测到的 JDK 目录名）
- JDK 管理对话框打开时，若列表为空，自动填充系统检测到的默认 JDK
- 默认 JDK 检测顺序：`jarEditor.javaHome` 配置 → `JAVA_HOME` 环境变量

### JDK 与 Target 联动

切换 JDK 下拉框时：

1. Extension 使用所选 JDK 的 `javac -version` 检测版本
2. 重新生成 Target 选项列表（Java 1.1 到该 JDK 支持的最高版本）
3. Target 下拉框自动更新，默认选中当前 class 文件字节码版本对应的 target
4. Save 时使用当前选中的 JDK 和 Target 进行编译

### 持久化

JDK 列表存储在 `context.globalState`，key 为 `jarEditor.jdkList`：

- 跨项目共享
- 跨 VSCode 重启持久化
- 数据格式：`JdkEntry[]`，每项包含 `name` 和 `path`

## 数据流

### 打开 JDK 对话框

```
点击 JDK 链接
→ webview 发送 openJdkManager
→ extension 读取 JdkManager.getJdkListForDialog()
→ 发送 showJdkDialog + list 到 webview
→ webview 显示模态框
```

### 保存 JDK 列表

```
点击 OK
→ webview 发送 saveJdkList + list
→ extension 写入 globalState
→ JdkManager 触发 onDidChange 事件
→ 所有打开的编辑器收到通知，刷新 JDK 下拉框
```

### 切换 JDK

```
JDK 下拉框 change
→ webview 发送 jdkChanged + homePath
→ extension 用该 JDK 的 javac 检测版本（带 `JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8 -Duser.language=en`）
→ 生成新 Target 列表
→ 发送 updateTargetOptions 到 webview
→ webview 更新 Target 下拉框
```

### 编译 .class

```
点击 Save
→ extension 收到 save 消息
→ handleSave(currentText, currentTarget, currentJdkHome)
→ jarEditService.saveEntry(..., jdkHome)
→ compileJavaSource 使用 jdkHome/bin/javac（若为空则走 findJavaToolExecutable 默认逻辑）
→ 编译进程带 `JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8 -Duser.language=en`
```

### 选择 JDK Home 目录

```
点击 📂 按钮
→ webview 发送 browseJdkFolder + index
→ extension 调用 vscode.window.showOpenDialog
→ 发送 jdkFolderSelected + path 到 webview
→ webview 更新对应条目的 path（若 name 为空则自动取目录名）
```

## 主要文件

| 文件 | 说明 |
|------|------|
| `src/jdkManager.ts` | JDK 数据管理：读写 globalState、生成下拉框列表、检测默认 JDK、`onDidChange` 事件 |
| `src/jarEditorToolProvider.ts` | 工具栏 JDK 链接 + 下拉框、模态对话框 HTML/CSS/JS、消息处理 |
| `src/jarEditService.ts` | 编译链路支持 `jdkHome` 参数、按 JDK 检测版本生成 Target 列表（带缓存） |

## 验证方式

1. 打开一个 `.class` 文件，确认工具栏显示 JDK 链接和下拉框
2. 点击 JDK 链接，确认弹出模态对话框（非新标签页）
3. 添加一个 JDK 条目，填写 Name 和 Home 路径，点击 OK
4. 确认 JDK 下拉框中出现新添加的 JDK
5. 切换 JDK 下拉框，确认 Target 下拉框选项范围随之变化
6. 选择不同 JDK，点击 Save，确认使用对应的 javac 编译成功
7. 关闭 VSCode 重新打开另一个项目，确认 JDK 列表仍在
8. 打开非 `.class` 文件，确认 JDK 链接和下拉框不显示
