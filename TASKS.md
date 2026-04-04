# OpenDiff TASKS.md — 功能进度

> 最后更新：v0.2.11 — 2026-04-04

---

## ✅ 已完成

| Hour | 功能 | Commit |
|------|------|--------|
| H1 | Session 管理器 UI + Ctrl+Shift+S 切换器 | 05632e5 |
| H2 | Folder Sync 5 种同步模式 + 预览执行 | ca3b8c0 |
| H3 | 搜索 Ctrl+F + Importance 规则引擎 | cdcab58 |
| H4 | 三向合并 + 冲突解决 UI | 60cedb2 |
| H5 | 文件编码检测 + 编码切换下拉 | 7dda369 |
| H6 | CLI 参数 + Session 导入/导出 | 93a7827 |
| H7 | 移动端响应式布局（768px 断点） | 030dbc1 |
| H8 | README + BC_COMPARISON 同步 | 41b8038 |
| H12 | 差异书签（★ 图标 + Ctrl+Shift+B 面板） | cdcab58 |
| H13 | 差异过滤工具栏（All / + / − / ~） | 3638118 |
| H14 | 跨文件搜索面板（Ctrl+F 结果 LEFT+RIGHT） | c22cb59 |
| H15 | 图片对比（Alpha 通道 + 像素差异百分比） | 7461e5f |
| H16 | 命令面板（Ctrl+Shift+P） | b5881fc |
| H17 | Session 模板（代码审查 / 论文 / 日志预设） | HomeView |
| H18 | 最近文件跳转列表 | HomeView |
| H19 | 文件格式关联（30+ 扩展名） | b5881fc |
| H20 | Windows 注册表右键菜单 | Apr 4 |
| H21 | 自动更新检测（GitHub Releases API） | 7461e5f |

---

## 🔲 待完成

| Hour | 功能 |
|------|------|
| H9 | 深色/浅色主题适配 |
| H10 | 平板响应式布局（1024px 断点） |
| H11 | Hex 十六进制对比视图 |
| H22 | 快捷键自定义 UI |
| H23 | 差异报告导出（HTML / PDF） |
| H24 | 集成测试 + v1.0 README |

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

## 完成标准

每个 Hour 完成须满足：
1. ✅ 代码提交并推送到 GitHub
2. ✅ Web 预览部署成功
3. ✅ Windows 便携包可下载
4. ✅ README/TASKS.md 同步更新
