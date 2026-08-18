import { convertFileSrc } from '@tauri-apps/api/core'

export function localFileSrc(path: string): string {
  if (!path) {
    return ''
  }

  if (typeof convertFileSrc !== 'function') {
    return path
  }

  try {
    return convertFileSrc(path)
  } catch {
    return path
  }
}
