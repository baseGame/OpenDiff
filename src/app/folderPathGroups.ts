/** Path-prefix expand/collapse helpers for flat folder plan/preview rows. */

export function parentPathPrefix(relativePath: string): string {
  const normalized = relativePath.replaceAll('\\', '/').replace(/^\/+|\/+$/gu, '')
  const parts = normalized.split('/').filter(Boolean)

  if (parts.length <= 1) {
    return ''
  }

  return parts.slice(0, -1).join('/')
}

export function collectExpandablePrefixes(relativePaths: readonly string[]): string[] {
  const prefixes = new Set<string>()

  for (const relativePath of relativePaths) {
    const normalized = relativePath.replaceAll('\\', '/').replace(/^\/+|\/+$/gu, '')
    const parts = normalized.split('/').filter(Boolean)

    for (let index = 1; index < parts.length; index += 1) {
      prefixes.add(parts.slice(0, index).join('/'))
    }
  }

  return [...prefixes].sort((left, right) => left.localeCompare(right))
}

export function isPathHiddenByCollapse(
  relativePath: string,
  collapsedPrefixes: ReadonlySet<string>,
): boolean {
  if (collapsedPrefixes.size === 0) {
    return false
  }

  const normalized = relativePath.replaceAll('\\', '/').replace(/^\/+|\/+$/gu, '')
  const parts = normalized.split('/').filter(Boolean)

  for (let index = 1; index < parts.length; index += 1) {
    if (collapsedPrefixes.has(parts.slice(0, index).join('/'))) {
      return true
    }
  }

  return false
}
