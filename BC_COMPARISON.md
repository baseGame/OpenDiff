# Beyond Compare 4 vs OpenDiff v0.2 — 功能差距分析

> 基于 Beyond Compare 4.2 Pro 功能清单，逐条对比

---

## ✅ 已实现（完成度 70%）

| 类别 | Beyond Compare | OpenDiff | 状态 |
|------|---------------|----------|------|
| 文本对比 | ✅ 侧比分屏 | ✅ 侧比分屏 | ✅ |
| 语法的高亮 | ✅ Grammar 体系 | ✅ highlight.js | ✅ |
| 行内字符级差异 | ✅ 字符级 | ✅ 字符级 | ✅ |
| 同步滚动 | ✅ | ✅ | ✅ |
| 文件夹对比 | ✅ | ✅ | ✅ |
| CRC 文件夹对比 | ✅ | ✅ | ✅ |
| 表格对比 | ✅ CSV/表 | ✅ LCS 表格 | ✅ |
| 图片对比 | ✅ | ✅ 像素 diff | ✅ |
| 十六进制对比 | ✅ | ✅ | ✅ |
| 拖放文件 | ✅ | ✅ | ✅ |
| 多语言 i18n | ✅ | ✅ 中英文 | ✅ |
| 历史记录 | ⚠️ 基础 | ✅ 基础 | ⚠️ 部分 |
| 键盘快捷键 | ✅ 丰富 | ⚠️ 少数 | ⚠️ |
| 深色主题 | ✅ | ✅ | ✅ |
| Session 保存 | ✅ 完整 | ⚠️ 自动存 | ❌ |

---

## ❌ 未实现 / 差距大

### 1. Session 管理（核心）
- ❌ Session 命名保存（Beyond: 任意名称）
- ❌ Session 分组（Text / Folder / Table / FTP 等）
- ❌ Session 收藏夹
- ❌ Session 快速切换器（Ctrl+Shift+S）
- ❌ Session 导入/导出
- ❌ 默认 Session 模板

### 2. 三向合并（Text Merge）
- ❌ 三向合并视图（Left / Base / Right → Output）
- ❌ 冲突解决 UI（Accept Left/Right/Both）
- ❌ 自动合并无冲突部分
- ❌ 合并结果预览
- ❌ 合并结果保存

### 3. 文件夹同步（Folder Sync）
- ❌ 5 种同步方式：Update Left / Update Right / Mirror to Left / Mirror to Right / Custom
- ❌ 预览模式（先预览再执行）
- ❌ 同步执行 + 进度显示
- ❌ 同步报告
- ❌ 定时同步 / 自动化

### 4. Importance 规则（文本重要性）
- ❌ "不重要文本" 规则（忽略特定模式）
- ❌ 正则表达式支持
- ❌ Importance 优先级（重要 > 不重要）
- ❌ 规则存储 + 跨 Session 复用
- ❌ Grammar 语法元素体系

### 5. 文件编码支持
- ❌ 文件编码检测
- ❌ 编码切换（GBK / UTF-8 / Big5 / Shift-JIS）
- ❌ BOM 处理
- ❌ 多编码同时显示

### 6. 表格对比增强
- ❌ 列映射 / 列重排
- ❌ 列过滤（只看某列）
- ❌ 单元格级对齐
- ❌ 表格格式预设（CSV / TSV / SQL / Excel）

### 7. 搜索增强
- ❌ 当前文件内搜索（Ctrl+F）
- ❌ 正则搜索
- ❌ 跨文件搜索
- ❌ 搜索结果导航

### 8. 导航增强
- ❌ 跳转到行（Ctrl+G）
- ❌ 差异总数统计
- ❌ 差异书签
- ❌ 差异过滤（只看某种类型）

### 9. 外部格式支持
- ❌ 文件格式预设（.c .py .js 独立规则）
- ❌ 格式导入/导出
- ❌ 文件格式关联

### 10. 杂项
- ❌ 命令行调用（`opendiff.exe left.txt right.txt`）
- ❌ Windows 右键菜单集成
- ❌ 可移植模式（Portable）
- ❌ MSI 企业部署
- ❌ FTP/SFTP 远程文件夹
- ❌ 注册表对比
- ❌ MP3/图片元数据对比

---

## 子任务拆分（按优先级）

### P0 — 核心体验（Hour 1~3）
- [ ] **Hour 1**: Session 管理器 UI（命名保存 + 分组 + 快速切换 Ctrl+Shift+S）
- [ ] **Hour 2**: Session 快速切换器浮层（Ctrl+Shift+S 弹窗）
- [ ] **Hour 3**: FolderDiffView 添加 Folder Sync 同步引擎（5种同步方式）

### P1 — 差异导航（Hour 4~5）
- [ ] **Hour 4**: Importance 规则引擎 + 规则编辑器 UI
- [ ] **Hour 5**: 搜索栏（Ctrl+F 搜索当前文件）+ 跳转到行（Ctrl+G）

### P2 — 三向合并（Hour 6~7）
- [ ] **Hour 6**: 三向合并面板（TextDiffView → 添加 Base 输入框）
- [ ] **Hour 7**: 冲突解决 UI + 自动合并 + 保存结果

### P3 — 编码 + 表格增强（Hour 8~9）
- [ ] **Hour 8**: 文件编码检测 + 编码切换下拉菜单
- [ ] **Hour 9**: TableDiffView 列映射 + 列过滤 + 单元格对齐

### P4 — 收尾 + 体验（Hour 10~12）
- [ ] **Hour 10**: 命令行参数支持（`opendiff.exe --help`）
- [ ] **Hour 11**: Session 导入/导出（JSON）
- [ ] **Hour 12**: 右键菜单集成（Windows 注册表）
