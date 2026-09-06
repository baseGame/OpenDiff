import {
  classifyDropInputs,
  type DropClassification,
  type DropInput,
  type ValidDropClassification,
} from '@/app/dropInput'
import { resolveDropInputsFromPaths } from '@/app/desktopDrop'
import { selectSessionForDrop, type SessionSelection } from '@/app/sessionAutoSelect'
import type { SessionLaunchLocation, SessionLaunchPayload } from '@/types/sessionLaunch'

export interface DropLaunchReady {
  ok: true
  classification: ValidDropClassification
  selection: SessionSelection & { route: string; enabled: true }
  payload: SessionLaunchPayload
}

export interface DropLaunchRejected {
  ok: false
  reason: string
  classification: DropClassification
  selection?: SessionSelection
}

export type DropLaunchResult = DropLaunchReady | DropLaunchRejected

export interface DropLaunchOptions {
  autoRun?: boolean
  id?: string
}

/** Classify drop inputs, pick a session, and build a launch payload when supported. */
export function resolveDropLaunch(
  inputs: DropInput[],
  options: DropLaunchOptions = {},
): DropLaunchResult {
  const classification = classifyDropInputs(inputs)

  if (classification.kind === 'invalid') {
    return {
      ok: false,
      reason: classification.reason,
      classification,
    }
  }

  const selection = selectSessionForDrop(classification)

  if (!selection.enabled || !selection.route) {
    return {
      ok: false,
      reason: `${selection.title} is not available for this drop.`,
      classification,
      selection,
    }
  }

  const route = selection.route

  return {
    ok: true,
    classification,
    selection: { ...selection, route, enabled: true },
    payload: createLaunchFromDrop(classification, { ...selection, route }, options),
  }
}

/** Resolve absolute desktop paths, then build a drop launch (async classify when Tauri). */
export async function resolveDropLaunchFromPaths(
  paths: string[],
  options: DropLaunchOptions = {},
): Promise<DropLaunchResult> {
  const inputs = await resolveDropInputsFromPaths(paths)

  return resolveDropLaunch(inputs, options)
}

/** Mirror of HomeView createLaunchFromDrop — build SessionLaunchPayload from a valid drop. */
export function createLaunchFromDrop(
  classification: ValidDropClassification,
  selection: SessionSelection & { route: string },
  options: DropLaunchOptions = {},
): SessionLaunchPayload {
  return {
    id: options.id ?? crypto.randomUUID(),
    source: 'drop',
    sessionType: selection.sessionType,
    title: `${classification.left.displayName} <--> ${classification.right.displayName}`,
    route: selection.route,
    locations: {
      left: dropItemToLaunchLocation(classification.left),
      right:
        classification.kind === 'patch'
          ? undefined
          : dropItemToLaunchLocation(classification.right),
    },
    autoRun: options.autoRun ?? true,
  }
}

function dropItemToLaunchLocation(item: ValidDropClassification['left']): SessionLaunchLocation {
  return {
    uri: item.path,
    displayName: item.displayName,
    kind: item.sourceKind,
    readOnly: false,
  }
}
