# OpenDiff

> **Beyond Compare 1:1 开源复刻** — Vue 3 + Tauri 2 + Rust | Apache 2.0

[![CI](https://github.com/baseGame/OpenDiff/actions/workflows/ci.yml/badge.svg)](https://github.com/baseGame/OpenDiff/actions)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

---

## ✨ 特性

| 功能 | 状态 |
|------|------|
| **文本对比**（Myers / Patience / Histogram 三算法）| ✅ Phase 1 |
| **文件夹对比**与同步 | 🚧 Phase 2 |
| **表格对比**（CSV / Excel）| 🚧 Phase 3 |
| **十六进制对比** | 🚧 Phase 3 |
| **图片对比**（像素级）| 🚧 Phase 3 |
| FTP / SFTP / S3 / WebDAV | 🚧 Phase 4 |
| BCS 脚本引擎 + CLI | 🚧 Phase 5 |

## 🛠️ 技术栈

- **前端**: Vue 3.5 (Composition API + `<script setup>`) + TypeScript + Vite 6 + Pinia 3
- **框架**: Tauri 2.5 (系统 WebView, ~15MB 包体)
- **后端 (Rust)**: diff-engine / vfs / parsers / session / script-engine crates
- **数据库**: SQLite (via sqlx)
- **Diff 算法**: Histogram (默认) / Myers / Patience
- **语法高亮**: CodeMirror 6 + Tree-sitter (200+ 语言)

## 🚀 快速开始

### 前置要求

```bash
# Rust (推荐 rustup)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js 18+
# Linux 需要额外依赖:
sudo apt install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

### 开发模式

```bash
git clone https://github.com/baseGame/OpenDiff.git
cd OpenDiff
npm install
npm run tauri:dev
```

### 生产构建

```bash
npm run tauri:build
# 产物在 src-tauri/target/release/bundle/
```

## 📁 项目结构

```
OpenDiff/
├── src/                     # Vue 3 前端
│   ├── views/               # 各对比视图
│   ├── components/          # 通用 UI 组件
│   ├── stores/              # Pinia 状态管理
│   ├── api/                 # Tauri IPC 封装
│   └── types/               # TypeScript 类型
└── src-tauri/               # Rust 后端
    ├── src/
    │   ├── lib.rs           # Tauri app setup
    │   └── commands/        # IPC command handlers
    └── crates/
        ├── diff-engine/     # Diff 算法核心
        ├── vfs/             # 虚拟文件系统
        ├── parsers/         # 格式解析器
        ├── session/         # 会话持久化
        └── script-engine/   # BCS 脚本 + CLI
```

## 🗺️ 路线图

| 阶段 | 时间 | 目标 |
|------|------|------|
| Phase 0 | M1-2 | ✅ 基础框架搭建 |
| Phase 1 | M3-5 | 🚧 文本对比（完整）|
| Phase 2 | M6-8 | 文件夹对比 |
| Phase 3 | M9-11 | 扩展视图（表格/Hex/图片）|
| Phase 4 | M12-14 | VFS 网络后端 |
| Phase 5 | M15-16 | 脚本 + CLI + 集成 |
| Phase 6 | M17-18 | v1.0 正式发布 |

## 🤝 贡献

1. Fork 本仓库
2. 创建 feature 分支 (`git checkout -b feat/my-feature`)
3. Commit changes (`git commit -m 'feat: add xxx'`)
4. Push 并提交 PR

前端用 Vue 3 + TS，后端用 Rust，欢迎任何层面的贡献！

## 📄 License

Apache 2.0 — 商业友好，可 Fork 二次开发。

---

*OpenDiff is not affiliated with Scooter Software or Beyond Compare.*
