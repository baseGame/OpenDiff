/**
 * syntaxHighlight.ts — Phase 2 Feature
 * Lightweight syntax highlighter for 40+ languages using highlight.js.
 * Used by TextDiffView for rendering diffed code with proper colors.
 */
import hljs from 'highlight.js/lib/core'

// Register languages lazily (only what's used)
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import cpp from 'highlight.js/lib/languages/cpp'
import java from 'highlight.js/lib/languages/java'
import csharp from 'highlight.js/lib/languages/csharp'
import go from 'highlight.js/lib/languages/go'
import swift from 'highlight.js/lib/languages/swift'
import kotlin from 'highlight.js/lib/languages/kotlin'
import ruby from 'highlight.js/lib/languages/ruby'
import php from 'highlight.js/lib/languages/php'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import sql from 'highlight.js/lib/languages/sql'
import bash from 'highlight.js/lib/languages/bash'
import powershell from 'highlight.js/lib/languages/powershell'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import makefile from 'highlight.js/lib/languages/makefile'
import cmake from 'highlight.js/lib/languages/cmake'
import toml from 'highlight.js/lib/languages/ini'
import xml_like from 'highlight.js/lib/languages/xml'
import plaintext from 'highlight.js/lib/languages/plaintext'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('java', java)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('go', go)
hljs.registerLanguage('swift', swift)
hljs.registerLanguage('kotlin', kotlin)
hljs.registerLanguage('ruby', ruby)
hljs.registerLanguage('php', php)
hljs.registerLanguage('css', css)
hljs.registerLanguage('xml', xml_like)
hljs.registerLanguage('html', xml_like)
hljs.registerLanguage('vue', xml_like)
hljs.registerLanguage('json', json)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('zsh', bash)
hljs.registerLanguage('powershell', powershell)
hljs.registerLanguage('ps1', powershell)
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('docker', dockerfile)
hljs.registerLanguage('makefile', makefile)
hljs.registerLanguage('cmake', cmake)
hljs.registerLanguage('toml', toml)
hljs.registerLanguage('ini', toml)
hljs.registerLanguage('cfg', toml)
hljs.registerLanguage('plaintext', plaintext)

/**
 * Map file extension → highlight.js language id
 */
const EXT_MAP: Record<string, string> = {
  // JS/TS
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', mts: 'typescript', cts: 'typescript',
  jsx: 'javascript', tsx: 'typescript',
  // Web
  vue: 'xml', svelte: 'xml',
  html: 'xml', htm: 'xml',
  css: 'css', scss: 'css', sass: 'css', less: 'css',
  // Python
  py: 'python', pyw: 'python', pyi: 'python',
  // Rust
  rs: 'rust',
  // C family
  c: 'cpp', h: 'cpp', hpp: 'cpp', cc: 'cpp', cpp: 'cpp',
  java: 'java', kt: 'kotlin', kts: 'kotlin',
  cs: 'csharp', swift: 'swift',
  // Go
  go: 'go',
  // Scripting
  rb: 'ruby', php: 'php', pl: 'bash', pm: 'bash',
  // Config / Data
  json: 'json', jsonc: 'json',
  yaml: 'yaml', yml: 'yaml',
  toml: 'toml', ini: 'ini', cfg: 'ini',
  xml: 'xml', svg: 'xml',
  md: 'markdown', markdown: 'markdown',
  // Shell
  sh: 'bash', bash: 'bash', zsh: 'bash', ksh: 'bash',
  fish: 'bash', sh: 'bash',
  ps1: 'powershell', psm1: 'powershell',
  // Build
  dockerfile: 'dockerfile',
  makefile: 'makefile', Makefile: 'makefile',
  cmake: 'cmake', CMakeLists: 'cmake',
  // Misc
  sql: 'sql', r: 'plaintext', R: 'plaintext',
  lua: 'plaintext', perl: 'plaintext',
  csv: 'plaintext', tsv: 'plaintext',
  log: 'plaintext', txt: 'plaintext',
  env: 'bash', gitignore: 'bash', gitattributes: 'bash',
}

/**
 * Detect language from filename
 */
export function detectLanguage(filename: string): string {
  const lower = filename.toLowerCase()

  // Special filenames
  const specials: Record<string, string> = {
    'dockerfile': 'dockerfile',
    'makefile': 'makefile',
    'cmakelists.txt': 'cmake',
    'config': 'ini',
    '.gitignore': 'bash',
    '.env': 'bash',
    '.bashrc': 'bash',
    '.zshrc': 'bash',
    'package.json': 'json',
    'tsconfig.json': 'json',
    '.eslintrc': 'json',
    '.prettierrc': 'json',
    'cargo.toml': 'toml',
    'cargo.lock': 'toml',
    'pyproject.toml': 'toml',
    'setup.py': 'python',
    'requirements.txt': 'plaintext',
    'pom.xml': 'xml',
    'build.gradle': 'java',
    'build.gradle.kts': 'kotlin',
    '.csproj': 'xml',
    '.props': 'xml',
    '.targets': 'xml',
  }
  for (const [name, lang] of Object.entries(specials)) {
    if (lower.endsWith(name) || lower === name) return lang
  }

  // By extension
  const parts = lower.split('.')
  for (let i = parts.length - 1; i >= 1; i--) {
    const ext = parts.slice(i).join('.')
    if (EXT_MAP[ext]) return EXT_MAP[ext]
    if (EXT_MAP[parts[i]]) return EXT_MAP[parts[i]]
  }

  return 'plaintext'
}

/**
 * Highlight a single line of code, returning an array of
 * { text, className } spans for styled rendering.
 */
export interface HighlightSpan {
  text: string
  className: string
}

const TOKEN_CLASSES: Record<string, string> = {
  keyword:        'hl-keyword',
  built_in:       'hl-built_in',
  type:           'hl-type',
  literal:        'hl-literal',
  number:         'hl-number',
  string:         'hl-string',
  comment:        'hl-comment',
  'doctag':       'hl-comment',
  meta:           'hl-meta',
  'meta.keyword': 'hl-keyword',
  'meta.string':  'hl-string',
  variable:       'hl-variable',
  'variable.language': 'hl-variable',
  function:       'hl-function',
  title:          'hl-function',
  'title.class':  'hl-type',
  'title.function': 'hl-function',
  attr:           'hl-attr',
  attribute:      'hl-attr',
  selector:       'hl-selector',
  tag:            'hl-tag',
  name:           'hl-tag',
  bullet:         'hl-bullet',
  code:           'hl-code',
  emphasis:       'hl-emphasis',
  strong:         'hl-strong',
  formula:        'hl-code',
  link:           'hl-link',
  quote:          'hl-quote',
  section:        'hl-section',
  symbolic:       'hl-symbol',
  operator:       'hl-operator',
  punctuation:     'hl-punct',
  property:       'hl-property',
  params:         'hl-params',
  class:          'hl-class',
  'class.hlsl':   'hl-type',
  module:         'hl-module',
  constant:       'hl-number',
  switch:         'hl-keyword',
  arg:            'hl-params',
  env:            'hl-variable',
}

function sanitizeClass(cls: string): string {
  return TOKEN_CLASSES[cls] ?? `hl-${cls}`
}

/**
 * Highlight a code line, returning safe HTML string with span tags.
 * Falls back to plaintext on error.
 */
export function highlightLine(code: string, lang: string): string {
  if (!code && code !== '0') return ''
  try {
    if (lang === 'plaintext' || lang === 'text') {
      return escHtml(code)
    }
    const result = hljs.highlight(code, { language: lang, ignoreIllegals: true })
    return result.value
  } catch {
    return escHtml(code)
  }
}

/**
 * Escape HTML special characters
 */
function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Guess language from first line / content heuristics
 */
export function detectLanguageFromContent(filename: string, firstLine: string): string {
  const lang = detectLanguage(filename)
  if (lang !== 'plaintext') return lang

  const lower = firstLine.toLowerCase().trim()
  if (lower.startsWith('#!') && lower.includes('python')) return 'python'
  if (lower.startsWith('#!') && lower.includes('bash')) return 'bash'
  if (lower.startsWith('#!') && lower.includes('node')) return 'javascript'
  if (lower.startsWith('#!') && lower.includes('ruby')) return 'ruby'
  if (lower.startsWith('<?php')) return 'php'
  if (lower.startsWith('<!doctype')) return 'html'
  if (lower.startsWith('<html')) return 'html'
  if (lower.startsWith('{') || lower.startsWith('[')) return 'json'
  if (lower.startsWith('---') || lower.startsWith('%YAML')) return 'yaml'

  return lang
}
