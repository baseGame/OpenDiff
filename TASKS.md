# OpenDiff TASKS.md

> **v1.0.0** — 2026-04-17 · Git: `当前版本`

---

## ✅ 全部完成（27/27）

| Hour | 功能 | Commit | 状态 |
|------|------|--------|------|
| H1 | Session 管理器 UI + Ctrl+Shift+S 切换器 | 05632e5 | ✅ |
| H2 | Folder Sync 5 种同步模式 + 预览执行 | ca3b8c0 | ✅ |
| H3 | 搜索 Ctrl+F + Importance 规则引擎 | cdcab58 | ✅ |
| H4 | 三向合并 + 冲突解决 UI | 60cedb2 | ✅ |
| H5 | 文件编码检测 + 编码切换下拉 | 7dda369 | ✅ |
| H6 | CLI 参数 + Session 导入/导出 | 93a7827 | ✅ |
| H7 | 移动端响应式布局（768px 断点） | 030dbc1 | ✅ |
| H8 | README + BC_COMPARISON 同步 | 41b8038 | ✅ |
| H9 | 深色/浅色主题（平滑过渡 + 系统跟随） | 5c50170 | ✅ |
| H10 | 平板响应式布局（1024px 断点） | 5c50170 | ✅ |
| H11 | Hex 十六进制对比视图 | 5c50170 | ✅ |
| H12 | 差异书签（★ 图标 + Ctrl+Shift+B 面板） | cdcab58 | ✅ |
| H13 | 差异过滤工具栏（All / + / − / ~） | 3638118 | ✅ |
| H14 | 跨文件搜索面板（Ctrl+F 结果 LEFT+RIGHT） | c22cb59 | ✅ |
| H15 | 图片对比（Alpha 通道 + 像素差异百分比） | da98447 | ✅ |
| H16 | 命令面板（Ctrl+Shift+P） | b5881fc | ✅ |
| H17 | Session 模板（代码审查 / 论文 / 日志预设） | HomeView | ✅ |
| H18 | 最近文件跳转列表 | HomeView | ✅ |
| H19 | 文件格式关联（30+ 扩展名） | b5881fc | ✅ |
| H20 | Windows 注册表右键菜单 | Apr 4 | ✅ |
| H21 | 自动更新检测（GitHub Releases API） | 7461e5f | ✅ |
| H22 | 快捷键显示列表（SettingsView） | Apr 6 | ✅ |
| H23 | 差异报告导出（HTML 格式，含打印样式） | 5c50170 | ✅ |
| H24 | v1.0.0 README + 完整文档 | 6e25006 | ✅ |
| H25 | i18n 国际化（中文 + 英文） | i18n/ | ✅ |
| H26 | VFS 虚拟文件系统（本地/S3/SFTP/FTP/WebDAV） | crates/vfs/ | ✅ |
| H27 | BCS 脚本引擎基础框架 | crates/script-engine/ | ✅ |

---

## 🚧 开发中 / 部分完成

| 类别 | Beyond Compare | OpenDiff | 状态 | 说明 |
|------|---------------|----------|------|------|
| VFS 远程连接 UI | ✅ 完整界面 | 🚧 后端完成，UI 待集成 | 🚧 | S3/SFTP/FTP/WebDAV 后端已完成，需在 UI 中添加连接管理器 |
| BCS 脚本执行 | ✅ 完整脚本引擎 | 🚧 基础命令支持 | 🚧 | 支持 diff/merge/script 命令，需完善更多 BCS 兼容命令 |
| 更多语言支持 | ✅ 20+ 语言 | 🚧 仅中英文 | 🚧 | i18n 框架已完成，需添加日/韩/德/法等翻译 |
| 键盘快捷键 | ✅ 50+ 快捷键 | 🚧 ~20 个核心快捷键 | 🚧 | 核心功能已覆盖，需补充高级操作快捷键 |

---

## ❌ 未实现（规划中）

| 优先级 | 类别 | Beyond Compare | OpenDiff | 状态 | 备注 |
|--------|------|---------------|----------|------|------|
| P3 | FTP/SFTP 连接管理器 UI | ✅ | ❌ | ❌ | VFS 后端已完成，需 UI 集成 |
| P3 | 注册表对比 | ✅ | ❌ | ❌ | Windows 专用功能 |
| P3 | MSI 企业部署 | ✅ | ❌ | ❌ | 当前使用 NSIS/便携版 |
| P4 | 图片叠加/交替视图 | ✅ | ❌ | ❌ | 当前仅支持并排对比 |
| P4 | 定时同步任务 | ✅ | ❌ | ❌ | 需后台任务支持 |
| P4 | PDF/Word 文档对比 | ✅ | ❌ | ❌ | parsers 中有基础框架 |
| P4 | 插件系统 | ✅ | ❌ | ❌ | 扩展功能支持 |
| P4 | 云存储集成（OneDrive/Google Drive） | ✅ | ❌ | ❌ | 需 OAuth 认证 |

---

## 📦 核心模块状态

### Rust 后端 (src-tauri/)

| 模块 | 路径 | 状态 | 说明 |
|------|------|------|------|
| Diff Engine | crates/diff-engine/ | ✅ | Myers/Patience/Histogram 算法 |
| VFS | crates/vfs/ | ✅ | 本地/S3/SFTP/FTP/WebDAV |
| Parsers | crates/parsers/ | ✅ | CSV/Excel/PDF/Word/XML |
| Session | crates/session/ | ✅ | SQLite 持久化 |
| Script Engine | crates/script-engine/ | 🚧 | CLI/BCS 脚本解释器 |

### Tauri Commands (src-tauri/src/commands/)

| 命令 | 文件 | 状态 |
|------|------|------|
| diff_texts / diff_files | diff.rs | ✅ |
| merge_three | diff.rs | ✅ |
| diff_folders | folder_diff.rs | ✅ |
| diff_tables | table_diff.rs | ✅ |
| diff_images | image_diff.rs | ✅ |
| session CRUD | session.rs | ✅ |
| vfs operations | vfs.rs | ✅ |

### Vue 前端 (src/)

| 视图 | 文件 | 状态 |
|------|------|------|
| 首页 | HomeView.vue | ✅ |
| 文本对比 | TextDiffView.vue | ✅ |
| 文件夹对比 | FolderDiffView.vue | ✅ |
| 表格对比 | TableDiffView.vue | ✅ |
| 十六进制对比 | HexDiffView.vue | ✅ |
| 图片对比 | ImageDiffView.vue | ✅ |
| 历史记录 | HistoryView.vue | ✅ |
| 设置 | SettingsView.vue | ✅ |

---

## 🐛 已修复问题

| 问题 | 修复 | Commit |
|------|------|--------|
| Rust API 参数名不匹配 | `#[serde(alias = "...")]` | `36e7f7f` |
| DiffOptions ignore 字段别名 | `#[serde(alias = "ignoreWhitespace")]` | `2dfa905` |
| capabilities 权限配置 | `capabilities/main.json` | `3ff0447` |
| exe 启动崩溃（Windows） | `transparent: false` + `devtools: false` | Apr 4 |
| TextDiffView.vue 模板语法错误 | 恢复 v0.2.9 稳定版本 | `7461e5f` |

---

## 📊 功能完成度统计

| 类别 | Beyond Compare | OpenDiff | 完成率 |
|------|---------------|----------|--------|
| 核心对比功能 | 100% | 100% | ✅ |
| 文件支持 | 100% | 85% | 🚧 |
| UI/UX | 100% | 90% | 🚧 |
| 高级功能 | 100% | 70% | 🚧 |
| 部署选项 | 100% | 80% | 🚧 |
| **总体** | **100%** | **~85%** | **🚧** |
