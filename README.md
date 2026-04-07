# OpenDiff

<div align="center">

**Beyond Compare · 开源替代** · Vue 3 + Tauri 2 + Rust · Apache 2.0

[![CI](https://github.com/baseGame/OpenDiff/actions/workflows/ci.yml/badge.svg)](https://github.com/baseGame/OpenDiff/actions)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/baseGame/OpenDiff?style=flat)](https://github.com/baseGame/OpenDiff/stargazers)
[![Last Commit](https://img.shields.io/github/last-commit/baseGame/OpenDiff)](https://github.com/baseGame/OpenDiff/commits/master)

**🌐 在线预览：** https://opendiff.app

**🪟 Windows 便携版：** [Releases](https://github.com/baseGame/OpenDiff/releases/latest)

</div>

---

## 为什么选择 OpenDiff？

| | Beyond Compare | OpenDiff |
|---|---|---|
| 价格 | $79 / 许可证 | **免费** · Apache 2.0 |
| 平台 | Windows / macOS / Linux | Windows / macOS / Linux / Web |
| 隐私 | 数据上传云端 | **本地处理**，文件不离开设备 |
| 来源 | 闭源 | **完全开源**，可自行编译 |
| 安装 | ~60 MB 安装包 | **3.8 MB 便携包**，无需安装 |

---

## ✨ 功能全景

### 🔍 核心对比引擎
| 功能 | 说明 |
|---|---|
| **文本对比** | Myers / Patience / Histogram 三种算法自动切换 |
| **语法高亮** | 70+ 编程语言自动识别（Python, JS, TS, Rust, Go…） |
| **文件夹对比** | 5 种同步模式：Update Left / Right / Both / Mirror / Newer |
| **表格对比** | CSV / TSV / Excel 自动列映射 + 列过滤面板 |
| **十六进制对比** | Hex 视图，左右字节对照，差异高亮 |
| **图片对比** | 像素级 diff，支持 Alpha 通道，差异百分比显示 |
| **三向合并** | BASE + LEFT + RIGHT → 可视化冲突解决 |

### 🎨 专业 UI
| 功能 | 说明 |
|---|---|
| **深色 / 浅色主题** | 平滑过渡动画，跟随系统主题切换 |
| **平板适配** | 1024px / 768px 断点自适应布局 |
| **移动端适配** | 手机竖屏折叠工具栏，滚动操作 |
| **搜索 + 跳转** | `Ctrl+F` 全文搜索高亮，`Ctrl+G` 跳行 |
| **Importance 规则** | 正则标记不重要行并隐藏，支持预置规则 |
| **书签** | `Ctrl+Shift+B` 收藏差异行，快速跳转 |
| **差异过滤** | 工具栏 All / + 新增 / − 删除 / ~ 修改 快速过滤 |

### 📦 文件支持
| 功能 | 说明 |
|---|---|
| **编码检测** | UTF-8 / GBK / Big5 / Shift-JIS / EUC-KR 自动识别 |
| **编码切换** | 工具栏下拉随时切换，重新加载预览 |
| **CLI 参数** | `opendiff.exe --left file1 --right file2` 直接对比 |
| **拖放打开** | 拖两个文件到窗口，自动开始对比 |

### 💾 Session 管理
| 功能 | 说明 |
|---|---|
| **保存 / 加载** | 保存对比配置，下次一键恢复 |
| **导入 / 导出** | JSON 格式，批量迁移 |
| **最近文件** | 首页显示最近 10 条历史 |
| **模板预设** | 代码审查 / 论文 / 日志 快速模板 |

### 🛠 开发者工具
| 功能 | 说明 |
|---|---|
| **命令面板** | `Ctrl+Shift+P` 快速切换所有功能 |
| **快捷键** | 完整键盘操作覆盖，专注高效 |
| **报告导出** | HTML 格式差异报告，可打印 / 分享 |
| **右键菜单** | Windows 注册表集成，安装后右键直接对比 |
| **自动更新** | 启动时检测 GitHub Releases，有新版提示 |

---

## 🚀 快速开始

### Windows（推荐）
1. 下载 [OpenDiff-v0.2.12-windows.zip](https://github.com/baseGame/OpenDiff/releases/latest)
2. 解压到任意目录，双击 `opendiff.exe` 即可运行（无需安装）

### 可选：安装右键菜单
1. 解压后双击 `opendiff-install-context.reg`
2. 确认注册表写入
3. 右键任意文件 → **Compare with OpenDiff**

### Web 在线版
👉 访问 https://opendiff.app（无需下载）

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + O` | 打开左侧文件 |
| `Ctrl + Shift + O` | 打开右侧文件 |
| `Ctrl + F` | 全文搜索 |
| `Ctrl + G` | 跳转到行号 |
| `Ctrl + S` | 保存当前 Session |
| `Ctrl + Shift + S` | 打开 Session 切换器 |
| `Ctrl + Shift + P` | 命令面板 |
| `Ctrl + Shift + B` | 书签面板 |
| `F7` / `↑` | 上一个差异 |
| `F8` / `↓` | 下一个差异 |
| `Alt + A` | 显示全部 |
| `Alt + N` | 只看新增 |
| `Alt + D` | 只看删除 |
| `Alt + M` | 只看修改 |
| `Ctrl + ,` | 打开设置 |
| `Escape` | 关闭面板 / 取消操作 |

---

## 🏗 编译构建

### 环境要求
- Node.js ≥ 18
- pnpm ≥ 8
- Rust ≥ 1.70
- Cargo (Rust)

### 前端
```bash
pnpm install
pnpm build        # 构建生产版本 → dist/
pnpm dev          # 开发模式（热更新）
```

### Tauri 桌面应用
```bash
pnpm build        # 前端构建
cargo build --release --target x86_64-pc-windows-gnu
# Windows exe → src-tauri/target/x86_64-pc-windows-gnu/release/opendiff.exe
```

---

## 📁 项目结构

```
OpenDiff/
├── src/                      # Vue 3 前端
│   ├── views/                # 页面组件
│   │   ├── TextDiffView.vue  # 文本对比
│   │   ├── FolderDiffView.vue# 文件夹对比
│   │   ├── TableDiffView.vue # 表格对比
│   │   ├── HexDiffView.vue   # 十六进制对比
│   │   ├── ImageDiffView.vue # 图片对比
│   │   └── HomeView.vue      # 首页
│   ├── components/           # 可复用组件
│   ├── stores/               # Pinia 状态管理
│   ├── utils/                # 工具函数
│   └── assets/main.css       # 全局样式 + CSS 变量
│
├── src-tauri/                # Rust 后端
│   ├── src/commands/         # Tauri 命令
│   │   ├── diff.rs          # 文本 diff
│   │   ├── folder_diff.rs    # 文件夹 diff
│   │   ├── table_diff.rs     # 表格 diff
│   │   └── image_diff.rs     # 图片 diff
│   └── crates/              # Rust 子模块
│       ├── diff-engine/      # 核心 diff 算法（Myers + Patience）
│       ├── parsers/          # 文件解析器
│       ├── session/           # Session 持久化
│       └── vfs/              # 虚拟文件系统
│
└── TASKS.md                  # 功能开发进度表
```

---

## 🧩 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 + Composition API + TypeScript |
| 状态管理 | Pinia |
| 构建工具 | Vite 6 |
| UI 样式 | 原生 CSS 变量（无需 Tailwind） |
| 桌面框架 | Tauri 2 |
| 后端语言 | Rust |
| Diff 算法 | Myers + Patience + Histogram（Rust 实现） |
| 部署平台 | Web（CDN）+ Windows（便携 exe） |

---

## 🌐 功能对照表

| Beyond Compare 功能 | OpenDiff 实现 |
|---------------------|---------------|
| Text Compare | ✅ TextDiffView |
| Folder Compare | ✅ FolderDiffView |
| Table Compare | ✅ TableDiffView |
| Hex Compare | ✅ HexDiffView |
| Picture Compare | ✅ ImageDiffView |
| Synchronize Folders | ✅ FolderDiffView 同步模式 |
| Three-way Merge | ✅ TextDiffView BASE 模式 |
| Session Management | ✅ SessionPicker + history |
| Reporting | ✅ exportReport.ts (HTML) |
| Command Line | ✅ `opendiff --left --right` |
| Context Menu | ✅ install-context.reg |
| Auto Detection | ✅ Encoding detection |
| Filtering | ✅ All / Added / Deleted / Modified |
| Search | ✅ Ctrl+F |
| Binary Compare | ✅ HexDiffView |
| Folder Sync Rules | ✅ ImportanceRules engine |
| Themes | ✅ Dark / Light / Auto |
| Key Features | ✅ Beyond Compare 95% 覆盖 |

---

## 📄 许可证

Apache License 2.0 · 可商用、可修改、可分发

---

## 🙏 致谢

- **Diff 算法**：参考 `similar` Rust crate 的 Myers/Patience 实现
- **UI 设计**：参考 Beyond Compare 和 VS Code 的专业差异工具
- **图标**：Lucide Icons（MIT）
- **Tauri**：提供轻量级跨平台桌面框架
