/** Folder Compare and Text Compare session toolbar layouts. */

export interface SessionToolbarCommand {
  id: string
  glyph: string
  labelKey: string
  enabled: boolean
}

export const folderCompareToolbarOrder = [
  'home',
  'all',
  'same',
  'minor',
  'rules',
  'copy',
  'expand',
  'collapse',
  'select',
  'files',
  'refresh',
  'swap',
  'stop',
  'filters',
  'peek',
] as const

export const textCompareToolbarOrder = [
  'home',
  'all',
  'diffs',
  'same',
  'context',
  'minor',
  'rules',
  'copy',
  'next-section',
  'prev-section',
  'swap',
  'reload',
] as const

const folderMeta: Record<
  (typeof folderCompareToolbarOrder)[number],
  { glyph: string; labelKey: string }
> = {
  home: { glyph: 'H', labelKey: 'ui.home' },
  all: { glyph: '*', labelKey: 'ui.all' },
  same: { glyph: '=', labelKey: 'ui.same' },
  minor: { glyph: '~', labelKey: 'ui.minor' },
  rules: { glyph: 'R', labelKey: 'ui.rules' },
  copy: { glyph: 'C', labelKey: 'ui.copy' },
  expand: { glyph: '+', labelKey: 'ui.expand' },
  collapse: { glyph: '-', labelKey: 'ui.collapse' },
  select: { glyph: 'V', labelKey: 'ui.select' },
  files: { glyph: 'F', labelKey: 'ui.files' },
  refresh: { glyph: 'R', labelKey: 'ui.refresh' },
  swap: { glyph: '<>', labelKey: 'ui.swap' },
  stop: { glyph: 'X', labelKey: 'ui.stop' },
  filters: { glyph: 'F', labelKey: 'ui.filters' },
  peek: { glyph: 'P', labelKey: 'ui.peek' },
}

const textMeta: Record<
  (typeof textCompareToolbarOrder)[number],
  { glyph: string; labelKey: string }
> = {
  home: { glyph: 'H', labelKey: 'ui.home' },
  all: { glyph: '*', labelKey: 'ui.all' },
  diffs: { glyph: '!=', labelKey: 'ui.diffs' },
  same: { glyph: '=', labelKey: 'ui.same' },
  context: { glyph: 'C', labelKey: 'ui.context' },
  minor: { glyph: '~', labelKey: 'ui.minor' },
  rules: { glyph: 'R', labelKey: 'ui.rules' },
  copy: { glyph: 'C', labelKey: 'ui.copy' },
  'next-section': { glyph: 'N', labelKey: 'ui.nextSection' },
  'prev-section': { glyph: 'P', labelKey: 'ui.prevSection' },
  swap: { glyph: '<>', labelKey: 'ui.swap' },
  reload: { glyph: 'R', labelKey: 'ui.reload' },
}

export function buildFolderCompareToolbar(
  enabled: Partial<Record<(typeof folderCompareToolbarOrder)[number], boolean>>,
): SessionToolbarCommand[] {
  return folderCompareToolbarOrder.map((id) => ({
    id,
    glyph: folderMeta[id].glyph,
    labelKey: folderMeta[id].labelKey,
    enabled: Boolean(enabled[id]),
  }))
}

export function buildTextCompareToolbar(
  enabled: Partial<Record<(typeof textCompareToolbarOrder)[number], boolean>>,
): SessionToolbarCommand[] {
  return textCompareToolbarOrder.map((id) => ({
    id,
    glyph: textMeta[id].glyph,
    labelKey: textMeta[id].labelKey,
    enabled: Boolean(enabled[id]),
  }))
}

export function pathPairTitle(leftPath: string, rightPath: string): string {
  return `${pathBaseName(leftPath)} <--> ${pathBaseName(rightPath)}`
}

export function pathBaseName(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/\/+$/, '')
  const parts = normalized.split('/').filter(Boolean)

  return parts.at(-1) ?? path
}
