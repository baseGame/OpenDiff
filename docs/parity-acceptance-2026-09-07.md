# OpenDiff parity acceptance — 2026-09-07

## Audit basis

- Repo tip at audit start: `20805a2` (`Strengthen Text Merge with LCS diff3 conflict handling`, #68) and newer on this branch.
- Target captures: `docs/assets/beyond-compare-5-capture/*.png` + `ui-capture.json`
- Functional/UI spec: `docs/Beyond Compare 5 功能与 UI 记录.md` (doc baseline notes commercial **5.2.2**; track latest commercial **5.2.5.32528**, Aug 2026)
- Supersedes (outdated in places): `docs/Beyond Compare 5 当前项目实现对照审计.md`
- Product goal: match target UI/workflows as closely as practical (pixel/flow). Open-source must **not** copy trademarks, icons, or brand assets — window/product chrome uses **OpenDiff**.

### Commercial 5.2.2 → 5.2.5 deltas (callouts only)

Notable 5.2.5 fixes (no major session-type redesign): Win7 startup hang; Table Compare date/time cell decode; Hex Compare Go To past `0x7FFFFFFF`; Folder Compare Confirm File Replace width (RU); installer caption build number. **OpenDiff gaps below are not driven by 5.2.5 UI changes**; Hex Go To / large-offset and Table date decode remain relevant engineering follow-ups if we claim deep Hex/Table parity.

### Post-#55–#68 context (what moved since the old audit)

| PR theme                                     | Effect on honesty of old audit                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| #55 Home/menus                               | Home tree + 12 launch cards; Session/View/Tools/Help (and session-specific menus) — old “custom menus / 4 quick starts” is outdated |
| #58 Folder Compare ops                       | Copy/Move/Rename/Delete/Attributes/Touch real — old “fake ops” outdated                                                             |
| #59 Sync/Merge execute                       | Folder Sync + Folder Merge + Text Merge load/execute real — old “preview-only / plan-only” outdated                                 |
| #60 Table/Hex/Picture toolbars               | Session toolbars wired to real actions                                                                                              |
| #61 Options/Formats/Profiles/Reports persist | Persistence landed — old “memory-only” outdated                                                                                     |
| #62 narrow Folder Compare / clipped menus    | Layout hardening                                                                                                                    |
| #63 Rules/Filters toolbar                    | Folder + Text session Rules/Filters actions                                                                                         |
| #64 Options fonts/diff colors                | Colors/fonts/tweaks deepened                                                                                                        |
| #65 Picture Tol/Range                        | Tolerance wired into compare                                                                                                        |
| #66 Table Excel/HTML sheets                  | Multi-sheet/table handling deepened                                                                                                 |
| #67 Remote browse/connect                    | Saved remote profile browse/connect                                                                                                 |
| #68 Text Merge LCS diff3                     | Conflict handling strengthened — old “no real merge algo” outdated                                                                  |

**Completely identical (完全一致) is NOT true.** Remaining work is still large; matrix below is honest PASS / PARTIAL / FAIL vs captures+spec.

## Scoring legend

- **PASS** — structure and primary workflow match captures/spec closely enough for acceptance of that area (minor cosmetic OK; no trademark copy required).
- **PARTIAL** — usable real behavior + recognizable layout/menus/toolbars, but visible gaps vs captures/spec.
- **FAIL** — missing primary workflow, stub-only controls, or layout/menus still fundamentally unlike the capture.

## Acceptance matrix

| Area                                       | Verdict     | Evidence (OpenDiff)                                                                                                                                                                                   | Gaps vs captures/spec                                                                                                                                                                            |
| ------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Home**                                   | **PARTIAL** | `src/views/HomeView.vue` — left New tree (11 types) + Auto-saved/Today, center 12 launch cards, Open/Edit, drag/browse CTAs after #55/#62                                                             | Still wrapped in `WorkbenchShell` (not capture chrome); Edit disabled; Lucide icons (not brand tiles); pixel grid/spacing ≠ `home.png`; product title `Home - OpenDiff`                          |
| **Global menus**                           | **PARTIAL** | `src/layouts/AppLayout.vue` `visibleAppMenus` — Home: Session/View/Tools/Help; Folder*: +Actions; File sessions: Session/File/Edit/Search/View/Tools/Help; Picture omits Search (`AppLayout.test.ts`) | Many Session/Tools items still disabled/noop; Help Contents/Support were stub/`enabled:false` before this PR’s Help wiring; command bodies ≠ full target menus                                   |
| **Folder Compare**                         | **PARTIAL** | `FolderCompareView.vue` + `api/diff.ts` folder ops; toolbar `sessionToolbars.ts`; Rules/Filters #63; real file ops #58                                                                                | Align With / Break Alignment were disabled stubs (addressed in this PR as client rematch); remote/archive side incomplete vs Pro; Filters/Peek/Select depth; toolbar iconography/order ≠ capture |
| **Folder Sync**                            | **PARTIAL** | `FolderSyncView.vue` + `api/sync.ts` `preview_folder_sync` / `execute_folder_sync` (#59)                                                                                                              | Title pattern `Update: left <--> right` not always applied; Accept/Cancel/per-row override UX thinner than capture; toolbar chrome ≠ `folder-sync.png`                                           |
| **Folder Merge**                           | **PARTIAL** | `FolderMergeView.vue` + `api/folderMerge.ts` plan + `execute_folder_merge_plan` (#59); content conflicts → Text Merge                                                                                 | Same OK / Peek / full three-way UI chrome; output path title pattern; conflict UX vs `folder-merge.png`                                                                                          |
| **Text Compare**                           | **PARTIAL** | `TextCompareView.vue` + `diff_text` / Myers·Patience·Histogram; session toolbar; Rules/Filters #63; report export API                                                                                 | Session Settings (Importance/Alignment/Replacements) incomplete; pixel toolbar/editor chrome ≠ `text-compare.png`                                                                                |
| **Text Merge**                             | **PARTIAL** | `TextMergeView.vue` + `merge_text_files` LCS diff3 (#68); Accept left/base/right; save output                                                                                                         | Favor Left/Right, pane sync chrome, conflict toolbar parity vs `text-merge.png`; 4-way not present                                                                                               |
| **Table**                                  | **PARTIAL** | `TableCompareView.vue` + `compare_table` + `tableSheets.ts` Excel/HTML sheets (#66); toolbar #60                                                                                                      | Key/ignore-column depth; date/time cell edge cases (see 5.2.5 commercial fix); UI ≠ `table-compare.png`                                                                                          |
| **Hex**                                    | **PARTIAL** | `HexCompareView.vue` + `compare_hex_files`; find/save APIs; toolbar #60                                                                                                                               | Windowed browse/Go To (incl. >2GB offsets per 5.2.5 theme); full Rules; chrome ≠ `hex-compare.png`                                                                                               |
| **Picture**                                | **PARTIAL** | `PictureCompareView.vue` + Tol/Range → tolerance (#65); toolbar #60                                                                                                                                   | Blend/Meta/Minor full semantics; report; pixel chrome ≠ `picture-compare.png`                                                                                                                    |
| **Registry**                               | **PARTIAL** | `RegistryCompareView.vue` + `.reg` export compare; live query API exists but not full hive browse/edit                                                                                                | Live registry edit/copy; toolbar Expand/Collapse completeness; ≠ `registry-compare.png`                                                                                                          |
| **Media**                                  | **FAIL**    | `MediaCompareView.vue` — metadata field compare only                                                                                                                                                  | No Play2 / scrub / dual playback from `media-compare.png`; rules/importance thin                                                                                                                 |
| **Version**                                | **PARTIAL** | `VersionCompareView.vue` — Windows version resources; non-Windows unsupported                                                                                                                         | Toolbar All/Diffs/Same/Minor/Rules; non-Windows strategy; ≠ `version-compare.png`                                                                                                                |
| **Text Edit**                              | **PARTIAL** | `TextEditView.vue` — open/save/find/replace                                                                                                                                                           | Capture toolbar Undo/Redo/Cut/Copy/Paste/Delete/Syntax incomplete vs `text-edit.png`                                                                                                             |
| **Text Patch**                             | **PARTIAL** | `TextPatchView.vue` + parse/apply APIs                                                                                                                                                                | Section nav + open Text Compare from patch thinner than `text-patch.png`                                                                                                                         |
| **Options / Formats / Profiles / Reports** | **PARTIAL** | `SettingsView.vue` fonts/diff colors (#64); `FileFormatView.vue` / `RemoteProfileView.vue` persist (#61); `reports/ReportsScriptView.vue` real export + limited script runner; remote browse (#67)    | Not full Options tree (Appearance/Toolbars/Tweaks/Backup…); Profiles ≠ all cloud protocols; script subset (see i18n unsupported list)                                                            |
| **Shell integration**                      | **PARTIAL** | `api/integration.ts` Win + Unix register; Settings UI; Linux Thunar DnD #56; Explorer productization #44/#45                                                                                          | Capture-level shell verbs/menus incomplete cross-platform; registration UX uneven                                                                                                                |
| **CLI**                                    | **PARTIAL** | `src-tauri/src/cli.rs` + `cli-core` — compare/sync/merge/report/git/svn helpers                                                                                                                       | Not full target `/fv`·`/sync` compatibility surface; exit-code contract exists but workflow coverage gaps                                                                                        |

### Counts (area-level)

| Verdict | Count                                   |
| ------- | --------------------------------------- |
| PASS    | **0**                                   |
| PARTIAL | **17**                                  |
| FAIL    | **1** (Media primary playback workflow) |

Sub-feature FAIL items exist inside PARTIAL areas (listed under P0–P2).

## Ranked remaining gaps

### P0 (high visibility / honesty / small real fixes)

1. **Help menu real actions** — About / Check for Updates / docs+support links (structure present; several were noop/disabled).
2. **Window/session title** — keep `left <--> right - Session` (product suffix `- OpenDiff`); sync `document.title`; cover more session types that still omit `setTabTitle`.
3. **Folder Align With / Break Alignment** — were disabled stubs with candidate UI; need real rematch behavior.
4. **`sessionCatalog` honesty** — every type `implemented: true` oversells archive/script and thinner sessions; need maturity labels without hiding launchable routes.
5. **Home Edit + chrome** — Edit still disabled; WorkbenchShell vs capture Home frame.

### P1 (workflow depth)

1. Folder Filters/Peek/Select + alignment persistence across rescan.
2. Text/Folder Session Settings (Importance, Alignment, Replacements, folder criteria UX).
3. Text Merge Favor/conflict chrome + pane sync.
4. Hex Go To / large offset + full windowed navigation.
5. Table keys/ignore columns end-to-end + date cell robustness.
6. Reports/scripts broader command coverage; Options page tree completeness.
7. Shell verb completeness; CLI flag compatibility pack.

### P2 (long-tail / platform)

1. Media playback and sync scrub.
2. Live Registry hive edit.
3. Version non-Windows strategy + importance rules.
4. Picture Blend/Meta polish + export.
5. Archive-as-folder / snapshot first-class session (today archive routes into Folder Compare).
6. Pixel-level toolbar iconography (without copying trademarked assets).

## Optional native smoke

Binary present: `/usr/bin/open-diff-app`. Optional screenshots directory reserved at `/workspace/open-diff-smoke/screenshots/bc5-acceptance-20805a2/` (capture when a display session is available). Automated UI capture is not required for this acceptance write-up.

## This acceptance PR scope

Implements the smallest real P0 closes: Help About/Updates/docs links, title sync, Align With/Break Alignment behavior, sessionCatalog maturity honesty, plus this document. Does **not** claim full capture parity.
