const audioExtensions = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus'])

const videoExtensions = new Set(['mp4', 'webm', 'ogv', 'mov', 'mkv', 'avi', 'm4v'])

export type MediaPlaybackKind = 'audio' | 'video' | 'unknown'

export function mediaPlaybackKind(path: string): MediaPlaybackKind {
  const extension = path.split(/[\\/]/u).pop()?.split('.').pop()?.toLowerCase() ?? ''

  if (audioExtensions.has(extension)) {
    return 'audio'
  }

  if (videoExtensions.has(extension)) {
    return 'video'
  }

  return 'unknown'
}

export function prefersVideoElement(leftPath: string, rightPath: string): boolean {
  return mediaPlaybackKind(leftPath) === 'video' || mediaPlaybackKind(rightPath) === 'video'
}
