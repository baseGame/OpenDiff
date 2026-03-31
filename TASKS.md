# OpenDiff v0.2 — 实施计划

## 当前状态（全部完成 ✅）

- ✅ 主页（5功能卡片 + 历史记录 + 侧栏）
- ✅ TextDiffView（语法高亮已集成）
- ✅ FolderDiffView（Rust diffFolders 已接入）
- ✅ TableDiffView（Rust LCS 已接入）
- ✅ HexDiffView（Rust 字节读取已接入）
- ✅ ImageDiffView（Rust 像素 diff 已接入）
- ✅ SettingsView（路由已注册）
- ✅ 多个按钮绑定完整
- ✅ Session History 页面完整
- ✅ HomeView 侧边栏 Profile 有功能
- ✅ Settings 持久化已验证

---

## 子任务列表（全部完成 ✅）

### Task 1: TextDiffView — 完整按钮绑定 + 加载状态 ✅
**Commit:** `dc9aade`

**验收完成项:**
- ✅ 点击 "Open file" 左侧/右侧 → 弹出文件选择框
- ✅ 工具栏算法/忽略空白/忽略大小写切换 → diff 重新计算
- ✅ Split/Unified 视图切换 → UI 立即切换
- ✅ "Prev ↑ / Next ↓" 导航按钮 → 跳转到上/下一个差异行
- ✅ Merge 按钮 → 显示/隐藏合并面板
- ✅ BASE 文件选择器 → 三路合并完整支持
- ✅ minimap 点击 → 滚动到对应行（已接入 @scroll-to）
- ✅ F7/F8 快捷键导航
- ✅ loading spinner + error retry 按钮
- ✅ 空状态引导文字

**文件:** `src/views/TextDiffView.vue`

---

### Task 2: FolderDiffView — 完整按钮绑定 + 操作反馈 ✅
**Commit:** `2dd5d4c`

**验收完成项:**
- ✅ "Open Left/Right" 文件夹按钮 → 弹出目录选择框
- ✅ 加载完成后 → 显示目录树（按 diff 着色）
- ✅ 点击目录可展开/折叠
- ✅ 双击文件行 → 打开 TextDiffView 对比两个文件
- ✅ Compare Mode (time/size/crc) 切换 → 重新对比并刷新颜色
- ✅ Filter (All/Diffs/Same/Left-only/Right-only) → 过滤显示
- ✅ 操作日志显示在底部面板
- ✅ 状态栏显示统计（相同/差异/仅左侧/仅右侧 文件数）
- ✅ 排除模式 Enter 键触发

**文件:** `src/views/FolderDiffView.vue`

---

### Task 3: TableDiffView — 完整按钮绑定 ✅
**Commit:** `498fa9a`

**验收完成项:**
- ✅ 左/右侧 "Browse" → 文件选择（CSV/TSV/XLSX）
- ✅ 分隔符选择 (逗号/Tab/分号) → 重新解析
- ✅ Header 行开关 → 影响对比结果
- ✅ Table/Unified 视图切换
- ✅ 差异行高亮显示（Added=绿/Deleted=红/Modified=黄）
- ✅ 列级 cell diff 高亮
- ✅ 统计面板显示 +添加/-删除/~修改 行数
- ✅ Rust LCS 算法对接

**文件:** `src/views/TableDiffView.vue`

---

### Task 4: Session History 页面 ✅
**Commit:** `9e240b7`

**验收完成项:**
- ✅ 路由 `/history`
- ✅ 显示所有历史会话
- ✅ 每个会话显示：类型图标、路径对、最后打开时间
- ✅ "恢复" 按钮 → 重新加载两个文件并导航
- ✅ "删除" 按钮 → 确认后删除（双击确认模式）
- ✅ "清空历史" 按钮
- ✅ HomeView 的 "View All History" → 导航到 `/history`
- ✅ 空状态页面 + CTA 按钮
- ✅ Error banner + 重试按钮

**文件:** `src/views/HistoryView.vue`, `router/index.ts`

---

### Task 5: Settings — 持久化验证 + 完整绑定 ✅
**Commit:** `9c7322c`

**验收完成项:**
- ✅ 打开 Settings → 从 Rust 后端加载当前设置
- ✅ 主题切换 → 立即应用（watch 自动保存）
- ✅ 字体/字号修改 → 立即预览（watch 自动应用 CSS）
- ✅ 重置默认 → 恢复出厂值
- ✅ 底部显示当前版本信息

**文件:** `src/views/SettingsView.vue`, `src/stores/settings.ts`

---

### Task 6: HomeView 侧栏 Profile + 完整按钮绑定 ✅
**Commit:** `47e365a`

**验收完成项:**
- ✅ "View All History" → 导航到 `/history`
- ✅ Saved Profiles 点击 → 打开文件选择器 → 启动对应视图
- ✅ Bookmark 按钮 → 收藏/取消收藏（localStorage 持久化）
- ✅ Tip 卡关闭按钮
- ✅ Recent Session Play 按钮 → 重新加载该会话

**文件:** `src/views/HomeView.vue`

---

### Task 7: 导航增强 + 快捷键 ✅
**Commit:** `4e095ce`

**验收完成项:**
- ✅ 面包屑导航（TextDiff / FolderDiff / TableDiff）
- ✅ 点击面包屑 Home → 返回主页
- ✅ Ctrl+O → 打开左侧文件
- ✅ Ctrl+Shift+O → 打开右侧文件
- ✅ Ctrl+, → 打开设置
- ✅ F7/F8 → 上/下差异导航
- ✅ Escape → 关闭 Merge 面板
- ✅ TabBar：点击切换 Tab、关闭按钮（自动切换到下一个 Tab）
- ✅ 全局键盘快捷键（在 App.vue 中统一处理）

**文件:** `src/App.vue`, `src/views/TextDiffView.vue`, `src/views/FolderDiffView.vue`, `src/views/TableDiffView.vue`, `src/components/tabs/TabBar.vue`

---

### Task 8: 全局 UI 优化 + 状态管理 ✅
**Commit:** `096d8ff`

**验收完成项:**
- ✅ GlobalToast 通知组件（success/error/info，自动消失）
- ✅ Toast 从任意组件通过 `inject('toast')` 调用
- ✅ TabBar 关闭按钮（点击关闭、自动切换到相邻 Tab）
- ✅ Error retry 按钮（TextDiffView）
- ✅ 空状态引导文字（TextDiffView）

**文件:** `src/App.vue`, `src/components/GlobalToast.vue`, `src/components/tabs/TabBar.vue`

---

## Git 提交历史

```
096d8ff feat(App): add GlobalToast component and keyboard shortcut improvements
4e095ce feat: global shortcuts + breadcrumb nav
47e365a feat(HomeView): sidebar profile buttons + bookmark toggle + tip close
9c7322c fix(SettingsView): add auto-save and immediate font apply
9e240b7 feat(History): add full session history management page
498fa9a fix(TableDiffView): show stats badges when Rust diff result is used
2dd5d4c feat(FolderDiffView): add folder stats bar + exclude glob Enter key handler
dc9aade feat(TextDiffView): add BASE file selector for 3-way merge
```

---

## 待完成（不在本版本范围内）

- [ ] macOS / Windows CI/CD 构建（本环境限制，需要 GitHub Actions）
- [ ] 深色/浅色主题完整适配（design system 变量待完善）
- [ ] 移动端响应式布局
- [ ] 多语言（i18n）支持
