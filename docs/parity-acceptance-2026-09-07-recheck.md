# OpenDiff parity re-acceptance — 2026-09-07 recheck

## Scope

- Tip under test: `e748dc2` (`Deepen registry chrome, archive folder sides, and merge conflict nav`, #74) on `master`.
- Prior matrix: `docs/parity-acceptance-2026-09-07.md` (written around #68–#69).
- This recheck covers landed work in **#69–#74** only. Native GUI click-smoke is out of scope here.
- Target references remain the capture PNGs under `docs/assets/` plus the functional/UI record docs (no trademarked product names in this recheck write-up).

## Automated regression at tip

| Suite                       | Result                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Vitest unit                 | **PASS** — 98 files / 468 tests                                                                                          |
| Playwright e2e              | **PASS** — 36 tests                                                                                                      |
| `cargo test --workspace`    | **PASS** — 338 lib/bin tests (exit 0)                                                                                    |
| Linux deb rebuild + install | **PASS** — `OpenDiff_1.1.2_amd64.deb` built from tip; installed to `/usr/bin/open-diff-app` (mtime 2026-09-07 08:34 UTC) |

No merge-caused test failures; no code fixes required for this recheck.

## What #69–#74 moved (honest deltas)

| PR  | Theme                                                                                                                | Matrix impact                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| #69 | Acceptance audit + small P0 closes (Help links, title sync, Align/Break rematch, sessionCatalog maturity)            | Home / Global menus / Folder Compare honesty improved; still PARTIAL                                |
| #70 | Home chrome + Edit / clipboard actions                                                                               | Home Edit no longer a hard stub; Edit/clipboard depth still thinner than captures                   |
| #71 | Session Settings dialog, Hex Go To, Folder Peek                                                                      | Text/Folder Session Settings and Hex offset navigation moved from stub → usable; Peek panel present |
| #72 | Options tree, Folder Select helpers, Media dual playback + sync scrub                                                | Options tree deepened; Media primary playback workflow present → **Media FAIL → PARTIAL**           |
| #73 | Overwrite backup gating, CLI open/sync entry expansion, folder bulk selection ops                                    | CLI + Folder Compare depth improved; backup/tweaks still incomplete vs full Options surface         |
| #74 | Registry Expand/Collapse workspace chrome, archive-as-folder side paths, Text Merge conflict nav (prev/next + Favor) | Registry / Folder archive / Text Merge chrome deepened; live hive edit and pixel parity still open  |

## Updated area matrix (post-#74)

Scoring legend unchanged from the base doc: **PASS** / **PARTIAL** / **FAIL**.

| Area                                       | Verdict     | Notes after #69–#74                                                                                                                   |
| ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Home**                                   | **PARTIAL** | Edit + clipboard wired (#70); still WorkbenchShell frame, Lucide tiles, spacing ≠ `home.png`                                          |
| **Global menus**                           | **PARTIAL** | Help real actions (#69); many Session/Tools items still disabled/noop                                                                 |
| **Folder Compare**                         | **PARTIAL** | Align/Break (#69), Peek (#71), Select/bulk (#72–#73), archive side paths (#74); Filters depth + toolbar pixel order remain            |
| **Folder Sync**                            | **PARTIAL** | Execute path real (#59); title/Accept-Cancel/per-row override UX thinner than capture                                                 |
| **Folder Merge**                           | **PARTIAL** | Execute + conflict → Text Merge real; Same OK / Peek / three-way chrome gaps remain                                                   |
| **Text Compare**                           | **PARTIAL** | Session Settings Importance/Alignment/Replacements dialog (#71); editor/toolbar chrome ≠ capture                                      |
| **Text Merge**                             | **PARTIAL** | Favor Left/Right policy + conflict prev/next (#74); pane sync / 4-way still missing                                                   |
| **Table**                                  | **PARTIAL** | Session options + Excel/HTML sheets; key/ignore-column + date cell robustness remain                                                  |
| **Hex**                                    | **PARTIAL** | Go To / large-offset parsing (#71) + session options; full windowed browse/Rules chrome remain                                        |
| **Picture**                                | **PARTIAL** | Tol/Range wired; Blend/Meta/Minor + report polish remain                                                                              |
| **Registry**                               | **PARTIAL** | Expand/Collapse + filter workspace (#74); still `.reg` export compare — live hive edit/copy incomplete                                |
| **Media**                                  | **PARTIAL** | Dual play/scrub + sync playback (#72); rules/importance and capture chrome remain thin                                                |
| **Version**                                | **PARTIAL** | Windows version resources; non-Windows strategy + toolbar importance remain                                                           |
| **Text Edit**                              | **PARTIAL** | Clipboard/edit actions improved via shared commands; syntax/toolbar parity remain                                                     |
| **Text Patch**                             | **PARTIAL** | Parse/apply real; section nav + open Text Compare thinner than capture                                                                |
| **Options / Formats / Profiles / Reports** | **PARTIAL** | Options tree groups (#72), overwrite backup gating (#73), remote browse (#67); not full Appearance/Toolbars/Tweaks/cloud protocol set |
| **Shell integration**                      | **PARTIAL** | Win + Unix register present; capture-level verbs uneven cross-platform                                                                |
| **CLI**                                    | **PARTIAL** | Open/sync entry expansion (#73); not full `/fv`·`/sync`-style compatibility surface                                                   |

### Counts (area-level, post-#74)

| Verdict | Count  |
| ------- | ------ |
| PASS    | **0**  |
| PARTIAL | **18** |
| FAIL    | **0**  |

Previously Media was the sole area-level **FAIL**; dual playback + scrub at #72 lifts it to **PARTIAL**. No area yet meets **PASS** (pixel/flow acceptance without major capture gaps).

## Ranked remaining gaps (post-#74)

### P0 (high visibility)

1. Home / session chrome vs captures (WorkbenchShell frame, tile grid, product title patterns).
2. Global Session/Tools menu bodies still largely noop/disabled.
3. Folder Filters depth + alignment persistence across rescan.
4. Registry live hive browse/edit (still export-file oriented).

### P1 (workflow depth)

1. Text/Folder Session Settings completeness (Importance/Alignment/Replacements/criteria vs captures).
2. Text Merge pane sync + richer conflict chrome; no 4-way.
3. Hex full windowed navigation / Rules; Table keys/ignore columns end-to-end.
4. Reports/scripts command coverage; Options Appearance/Toolbars/Tweaks completeness.
5. Shell verb completeness; CLI flag compatibility pack.
6. Archive-as-folder first-class session (today routed via Folder Compare sides).

### P2 (long-tail / platform)

1. Media rules/importance + capture-level Play2 chrome polish.
2. Version non-Windows strategy.
3. Picture Blend/Meta + export.
4. Pixel-level toolbar iconography (without copying trademarked assets).

## Honesty statement

Completely identical capture parity is **not** claimed. #69–#74 closed several honesty and workflow stubs (notably Media playback, Session Settings, Hex Go To, Folder Peek/Select, Registry chrome, merge conflict nav, CLI/backup gates), moving the area-level score from **0 PASS / 17 PARTIAL / 1 FAIL** to **0 PASS / 18 PARTIAL / 0 FAIL**. Remaining work is still large; native GUI smoke is left to a separate pass.
