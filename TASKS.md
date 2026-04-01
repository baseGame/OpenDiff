# OpenDiff v0.2 — 实施计划

## 当前状态（全部完成 ✅）

- ✅ 主页（5功能卡片 + 历史记录 + 侧栏）
- ✅ TextDiffView（语法高亮已集成）
- ✅ FolderDiffView（Rust diffFolders 已接入）
- ✅ TableDiffView（Rust LCS 已接入）
- ✅ HexDiffView（Rust 字节读取已接入）
- ✅ ImageDiffView（Rust 像素 diff 已接入）
- ✅ SettingsView（路由已注册）
- ✅ 所有按钮绑定完整，无静默按钮
- ✅ Session History 页面完整
- ✅ HomeView 侧边栏 Profile 有功能
- ✅ Settings 持久化已验证
- ✅ 深色/浅色主题变量完整
- ✅ **多语言支持：中文 + English**

---

## 多语言（i18n）✅

**新增文件：**
- `src/i18n/index.ts` — vue-i18n 核心，LOCALES 注册表（添加新语言只需添加一个文件）
- `src/i18n/en.ts` — English 翻译
- `src/i18n/zh.ts` — 中文翻译

**已接入的视图：**
- SettingsView — 语言切换下拉框（Settings → Appearance → Language）
- TextDiffView — 所有文本 i18n 化
- FolderDiffView — 所有文本 i18n 化
- TableDiffView — 所有文本 i18n 化
- HexDiffView — 所有文本 i18n 化
- ImageDiffView — 所有文本 i18n 化
- HomeView — 主要文本 i18n 化
- HistoryView — 所有文本 i18n 化

**添加新语言方法：**
1. 创建 `src/i18n/{lang}.ts`（复制 `en.ts` 并翻译）
2. 在 `LOCALES` 数组添加 `{ code, label, labelNative }`
3. 无需修改其他代码

**当前支持语言：**
- 🇺🇸 English
- 🇨🇳 中文

---

## 子任务列表（全部完成 ✅）

### Task 1–8: 全部完成 ✅
（见上方各任务提交记录）

---

## Git 提交历史（v0.2）

```
feat(i18n): full Chinese + English multi-language support
feat(HomeView): sidebar profile buttons + bookmark toggle + tip close
fix(SettingsView): add auto-save and immediate font apply
feat(History): add full session history management page
fix(TableDiffView): show stats badges when Rust diff result is used
feat(FolderDiffView): add folder stats bar + exclude glob Enter key handler
feat(TextDiffView): BASE file selector for 3-way merge
fix(TextDiffView): complete remaining task items
feat(App): GlobalToast component + keyboard shortcuts
feat: global shortcuts + breadcrumb nav
```

---

## 待完成

- [ ] CI/CD: macOS `.dmg` + Windows `.exe/.msi`（GitHub Actions 自动构建）
- [ ] 深色/浅色主题切换时 TabBar/侧边栏同步变化
- [ ] 多语言：日语、德语、法语等
