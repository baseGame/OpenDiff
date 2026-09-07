/** Honest script automation command catalogs for Reports/Scripts. */

export const supportedScriptCommands = [
  'LOAD',
  'FILTER',
  'COMPARE',
  'TEXT-REPORT',
  'FOLDER-REPORT',
  'FILE-REPORT',
  'REPORT',
  'HEX-REPORT',
  'TABLE-REPORT',
  'PICTURE-REPORT',
  'VERSION-REPORT',
  'REGISTRY-REPORT',
  'LOG',
  'BEEP',
  'OPTION',
  'SELECT',
  'COPY',
  'COPYTO',
  'DELETE',
  'RENAME',
  'TOUCH',
  'SNAPSHOT',
  'SYNC',
] as const

export const unsupportedScriptCommands = [
  'ATTRIB',
  'COLLAPSE',
  'CRITERIA',
  'EXPAND',
  'MEDIA-REPORT',
  'MOVE',
  'MOVETO',
] as const

export type SupportedScriptCommand = (typeof supportedScriptCommands)[number]
export type UnsupportedScriptCommand = (typeof unsupportedScriptCommands)[number]

export function formatCommandList(commands: readonly string[]): string {
  return commands.join(', ')
}

export const compareReportExampleScript = [
  'load "${left}"',
  'load "${right}"',
  'compare',
  'text-report "${output}"',
  'hex-report "${output}.hex.txt"',
  'folder-report "${output}.folder.txt"',
].join('\n')
