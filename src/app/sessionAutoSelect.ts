import { sessionCatalog } from '@/app/sessionCatalog'
import { sessionTypeForPath } from '@/app/fileFormats'
import type { ValidDropClassification } from '@/app/dropInput'
import type { SessionType } from '@/types/session'

export interface SessionSelection {
  sessionType: SessionType
  title: string
  titleKey?: string
  enabled: boolean
  route?: string
}

export function selectSessionForDrop(drop: ValidDropClassification): SessionSelection {
  if (drop.kind === 'folders') {
    return selectionFor('folder-compare')
  }

  if (drop.kind === 'mixed') {
    return selectionFor('hex-compare')
  }

  if (drop.kind === 'patch') {
    return selectionFor('text-patch')
  }

  const leftType = sessionTypeForPath(drop.left.path)
  const rightType = sessionTypeForPath(drop.right.path)

  if (leftType === rightType) {
    return selectionFor(leftType)
  }

  return selectionFor('hex-compare')
}

function selectionFor(sessionType: SessionType): SessionSelection {
  const entry = sessionCatalog.find((item) => item.type === sessionType)

  if (!entry) {
    return { sessionType, title: sessionType, enabled: false }
  }

  return {
    sessionType: entry.type,
    title: entry.title,
    titleKey: entry.titleKey,
    enabled: entry.implemented,
    route: entry.route,
  }
}
