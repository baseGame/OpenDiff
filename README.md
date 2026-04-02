# OpenDiff

> **Beyond Compare · 开源 1:1 复刻** — Vue 3 + Tauri 2 + Rust | Apache 2.0 | v0.2.10

[![CI](https://github.com/baseGame/OpenDiff/actions/workflows/ci.yml/badge.svg)](https://github.com/baseGame/OpenDiff/actions)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/baseGame/OpenDiff?style=flat)](https://github.com/baseGame/OpenDiff/stargazers)

**🌐 在线预览：** https://opendiff.app

**📦 Windows 便携版：** [Releases](https://github.com/baseGame/OpenDiff/releases/latest)

---

## ✨ 功能全景

| 功能 | 状态 | 说明 |
|------|:----:|------|
| **文本对比** | ✅ | Myers / Patience / Histogram 三算法，支持语法高亮 |
| **文件夹对比** | ✅ | 5 种同步模式（Update Left/Right/Both, Mirror） |
| **表格对比** | ✅ | CSV / TSV 自动列映射 + 列过滤面板 |
| **十六进制对比** | ✅ | Hex 视图，地址 / ASCII / 数据三栏 |
| **三向合并** | ✅ | BASE + LEFT + RIGHT → 冲突可视化解决 |
| **文件编码检测** | ✅ | UTF-8 / GBK / Big5 / Shift-JIS / EUC-KR 自动识别 |
| **编码切换** | ✅ | 工具栏下拉切换编码重新加载 |
| **搜索 + 跳转行** | ✅ | `Ctrl+F` 搜索高亮，`Ctrl+G` 跳行 |
| **Importance 规则** | ✅ | 正则标记不重要行并隐藏，支持预置规则 |
| **Session 管理** | ✅ | 保存 / 加载 / 删除对比会话 |
| **Session 导入/导出** | ✅ | JSON 格式批量管理 |
| **命令行参数** | ✅ | `opendiff.exe --left file1 --right file2` |
| **快捷键覆盖** | ✅ | `?` 查看所有快捷键 |
| **浅色 / 深色主题** | ✅ | 自动跟随系统 + 手动切换 |
| **拖拽文件** | ✅ | 直接拖入文件开始对比 |
| **自动保存** | ✅ | 对比结果自动保存到历史 |

---

## 🚀 快速开始

### 🪟 Windows（便携版）

下载最新 `OpenDiff-*-windows.zip`，解压后双击 `OpenDiff.exe` 即可，无需安装。

### 🧪 从源码构建

```bash
# 克隆
git clone https://github.com/baseGame/OpenDiff.git
cd OpenDiff

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 生产构建
pnpm build
```

### 🐧 Linux / macOS（Web 版）

```bash
pnpm install
pnpm dev
# 访问 http://localhost:1420
```

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+O` | 打开文件 |
| `Ctrl+S` | 保存 Session |
| `Ctrl+Shift+S` | 打开 Session 管理器 |
| `Ctrl+F` | 搜索高亮 |
| `Ctrl+G` | 跳转到行 |
| `↑ / ↓` | 上/下一处差异 |
| `Ctrl+M` | 执行三向合并 |
| `?` | 显示快捷键覆盖层 |

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────┐
│              Vue 3 + TypeScript              │
│   (TextDiffView · FolderDiffView · Table...)  │
└──────────────────┬──────────────────────────┘
                   │ invoke()
┌──────────────────▼──────────────────────────┐
│              Tauri 2 (Rust)                  │
│   diff_engine · parsers · script_engine     │
│   ┌────────────┬────────────┐               │
│   │  Myers     │ Patience   │  Histogram   │
│   └────────────┴────────────┘               │
└─────────────────────────────────────────────┘
```

**核心模块：**
- [diff-engine](src-tauri/crates/diff-engine/) — 文本 / 文件夹 / 三向合并算法
- [parsers](src-tauri/crates/parsers/) — CSV / TSV / Excel 解析
- [script-engine](src-tauri/crates/script-engine/) — 脚本自动化

---

## 🌍 对比 Beyond Compare 4 Pro

| 功能 | OpenDiff | BC4 Pro |
|------|:--------:|:-------:|
| 文本对比（多算法）| ✅ | ✅ |
| 文件夹同步（5模式）| ✅ | ✅ |
| 表格对比（列映射）| ✅ | ✅ |
| 十六进制视图 | ✅ | ✅ |
| 三向合并 | ✅ | ✅ |
| 编码自动检测 | ✅ | ✅ |
| Importance 规则 | ✅ | ✅ |
| Session 管理 | ✅ | ✅ |
| 正则搜索 | ✅ | ✅ |
| FTP/SFTP/云存储 | 🚧 | ✅ |
| 图片对比（像素级）| 🚧 | ✅ |
| 注册表右键菜单 | 🚧 | ✅ |
| BCS 脚本引擎 | 🚧 | ✅ |

> 🚧 = 开发中 | ✅ = 已完成

---

## 📁 项目结构

```
OpenDiff/
├── src/                          # Vue 3 前端
│   ├── views/                    # TextDiffView, FolderDiffView, TableDiffView...
│   ├── components/               # 搜索栏、合并面板、工具栏...
│   ├── api/                      # Tauri invoke() 封装
│   ├── stores/                   # Pinia 状态管理
│   ├── utils/                    # 编码检测、语法高亮...
│   ├── i18n/                     # 英文 + 中文国际化
│   └── assets/main.css           # 深浅主题 CSS 变量
├── src-tauri/
│   ├── src/commands/             # Rust Tauri 命令
│   └── crates/
│       ├── diff-engine/          # 核心算法
│       ├── parsers/              # 文件解析器
│       └── script-engine/        # 脚本引擎
├── BC_COMPARISON.md              # 功能差距追踪
└── TASKS.md                      # 开发任务看板
```

---

## 🐛 已知限制

- Windows 桌面版需要 WebView2 运行时（Windows 11 自带，Windows 10 可[下载](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)）
- 图片对比功能开发中
- FTP/SFTP 云存储正在开发

---

## 📄 许可证

Apache License 2.0 — 可免费商用，无需署名。

---

---

## 📋 更新日志

### v0.2.10（2026-04-02）
- ✅ 差异书签（Ctrl+Shift+B + ☆ 点击切换 + 书签导航）
- ✅ 响应式布局 + 移动端适配（768px / 480px 断点）
- ✅ 触摸友好 UI（36px 最小点击区域）
- ✅ CLI 参数支持（`opendiff.exe --left FILE --right FILE`）
- ✅ Session 导入/导出（JSON 格式）
- ✅ 三向合并面板（BASE + LEFT + RIGHT → 冲突可视化）
- ✅ 编码自动检测 + 工具栏切换（UTF-8 / GBK / Big5 / Shift-JIS）
- ✅ 搜索高亮（Ctrl+F）+ 跳转到行（Ctrl+G）
- ✅ Importance 规则引擎（正则 + 预置 + 隐藏行）
- ✅ 文件夹 5 种同步模式 + 预览执行
- ✅ Session 管理器（保存 / 加载 / 删除 / Ctrl+Shift+S）
- ✅ 浅色主题完整 CSS 变量支持
- 🐛 修复：HexDiffView 硬编码颜色 → CSS 变量

### v0.2.9（2026-04-02）
- ✅ 编码自动检测（UTF-8 / GBK / Big5 / Shift-JIS / EUC-KR）

### v0.2.8（2026-04-02）
- ✅ 三向合并 BASE 文件选择器
- ✅ 冲突 Accept Left / Right / Both 解决 UI

### v0.2.7（2026-04-01）
- ✅ 搜索栏（Ctrl+F）+ 搜索高亮
- ✅ 跳转到行（Ctrl+G）
- ✅ Importance 规则引擎（正则预置）
- ✅ Session 保存/加载/删除 UI

---

_If OpenDiff saves you time, consider giving it a ⭐_
