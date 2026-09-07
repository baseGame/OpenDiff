import type { SessionDocument, SessionType } from '@/types/session'

export type SessionLaunchSource =
  'home' | 'drop' | 'saved-session' | 'command' | 'workspace' | 'shell'

export interface SessionLaunchLocation {
  uri: string
  displayName?: string
  kind: 'file' | 'directory' | 'virtual'
  readOnly: boolean
}

export type SessionLaunchFavor = 'left' | 'right'

export interface SessionLaunchPayload {
  id: string
  source: SessionLaunchSource
  sessionType: SessionType
  title: string
  route: string
  locations: {
    left?: SessionLaunchLocation
    right?: SessionLaunchLocation
    center?: SessionLaunchLocation
    output?: SessionLaunchLocation
  }
  autoRun: boolean
  favor?: SessionLaunchFavor
  session?: SessionDocument
}
