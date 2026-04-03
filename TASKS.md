# OpenDiff TASKS.md — 待完成功能

> 最后更新：v0.2.10 — 2026-04-02

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

---

## ✅ 已修复（v0.2.10-patch）

| 问题 | 修复 | Commit |
|------|------|--------|
| Rust API 参数名不匹配 | `#[serde(alias = "...")]` 加到所有 Session/DiffOptions 字段 | `36e7f7f` |
| DiffOptions ignore 字段别名 | 同上，ignoreWhitespace/ignoreCase/ignoreComments | `2dfa905` |
| capabilities 权限配置 | `src-tauri/capabilities/main.json` 已创建 | `3ff0447` |

## 🔄 待完成

### H12 — 差异书签 ✅
- [x] 点击行号为该差异添加书签（★ 图标）
- [x] 书签列表浮层（Ctrl+Shift+B 打开）
- [x] 跳转到上一个/下一个书签
- [x] 书签数量徽章显示
- [x] Ctrl+Shift+B 全局切换书签面板

### H13 — 差异过滤 ✅
- [x] 工具栏过滤器按钮：**All / + 新增 / − 删除 / ~ 修改**
- [x] 过滤徽章显示当前过滤状态（高亮激活按钮）
- [x] 与 Importance 规则叠加生效
- [x] Ctrl+Shift+B 全局切换书签面板

### 🔧 紧急修复 (v0.2.10-patch1)
- [x] TextDiffView 所有按钮失效 → `ignoreWs` prop 名不匹配（IgnoreToolbar 期望 `ignoreWs`，TextDiffView 传 `ignoreWS`）
- [x] HTML5 File API 浏览器回退（`open()` 在浏览器报错）
- [x] 删除重复 bookmark 函数定义（导致 TypeScript 冲突）
- [x] 桌面/浏览器两用文件选择器（隐藏 `<input type=file>` 回退）

### H14 — 跨文件搜索
- [ ] 搜索范围选择：当前文件 / 两文件交叉搜索
- [ ] 搜索结果面板：显示每个匹配的文件+行号
- [ ] 点击结果跳转到对应位置

### H15 — 图片对比增强
- [ ] Alpha 通道支持（透明PNG diff）
- [ ] 像素差异热力图叠加层
- [ ] 差异比例百分比显示
- [ ] 支持 GIF 帧对比

### H16 — 命令面板（Ctrl+Shift+P）
- [ ] 模糊搜索所有命令（打开文件/执行同步/切换主题...）
- [ ] 最近命令历史
- [ ] 快捷键提示显示

### H17 — Session 模板
- [ ] 将当前对比配置保存为模板（算法/编码/Importance规则）
- [ ] 模板库（预置：代码审查 / 论文对比 / 日志对比）
- [ ] 模板导入/导出

### H18 — 最近文件跳转列表
- [ ] HomeView 侧边栏显示最近 10 个对比文件
- [ ] 悬停显示路径+时间
- [ ] 右键移除单条记录

### H19 — 文件格式关联
- [ ] .py / .js / .ts / .c / .cpp 独立语法高亮预设
- [ ] 设置页面：选择默认对比模式
- [ ] 记住每个扩展名的偏好设置

### H20 — Windows 注册表右键菜单
- [ ] 生成 `install-context-menu.reg` 文件
- [ ] 用户双击即添加 "OpenDiff 比较" 右键菜单
- [ ] 卸载脚本 `uninstall-context-menu.reg`

### H21 — 自动更新检测
- [ ] 启动时查询 GitHub Releases API
- [ ] 有新版本时 HomeView 显示更新提示
- [ ] 点击跳转下载页面

### H22 — 快捷键自定义 UI
- [ ] 设置页面：快捷键管理列表
- [ ] 点击修改快捷键（按键录制）
- [ ] 冲突检测（重复快捷键警告）
- [ ] 导出/导入快捷键配置

### H23 — 差异报告导出
- [ ] 导出为 HTML 报告（带样式，可分享）
- [ ] 导出为 PDF
- [ ] 报告包含：文件信息 + 差异统计 + 差异内容

### H24 — 集成测试 + 收尾
- [ ] 全流程测试：打开文件 → 对比 → 保存 Session → 加载
- [ ] 三向合并完整测试
- [ ] 文件夹同步完整测试
- [ ] 清理所有 console.warn
- [ ] 性能：加载 10MB 文件不卡顿
- [ ] v1.0.0 Release README

---

## 完成标准

每个 Hour 完成须满足：
1. ✅ 代码提交并推送到 GitHub
2. ✅ Web 预览部署成功
3. ✅ Windows 便携包可下载
4. ✅ README/TASKS.md 同步更新
5. ✅ 人工验收（或截图证明）

---

_Keep going until all ✅ are checked_
