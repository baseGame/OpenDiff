import { sessionTypeForPath } from '@/app/fileFormats'
import { sessionCatalog } from '@/app/sessionCatalog'
import type { SessionType } from '@/types/session'
import type { SessionLaunchPayload } from '@/types/sessionLaunch'

export function createChildCompareLaunch(
  leftPath: string,
  rightPath: string,
  source: SessionLaunchPayload['source'] = 'command',
): SessionLaunchPayload | undefined {
  const sessionType = sessionTypeForPair(leftPath, rightPath)
  const entry = sessionCatalog.find((item) => item.type === sessionType)

  if (!entry?.route || !entry.implemented) {
    return undefined
  }

  return {
    id: crypto.randomUUID(),
    source,
    sessionType,
    title: `${fileName(leftPath)} vs ${fileName(rightPath)}`,
    route: entry.route,
    autoRun: true,
    locations: {
      left: { uri: leftPath, displayName: fileName(leftPath), kind: 'file', readOnly: false },
      right: { uri: rightPath, displayName: fileName(rightPath), kind: 'file', readOnly: false },
    },
  }
}

export function sessionTypeForPair(leftPath: string, rightPath: string): SessionType {
  const leftType = sessionTypeForPath(leftPath)
  const rightType = sessionTypeForPath(rightPath)

  return leftType === rightType ? leftType : 'hex-compare'
}

function fileName(path: string): string {
  return path.replaceAll('\\', '/').split('/').at(-1) ?? path
}
