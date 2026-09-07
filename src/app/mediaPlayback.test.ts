import { describe, expect, it } from 'vitest'
import { mediaPlaybackKind, prefersVideoElement } from './mediaPlayback'

describe('mediaPlayback', () => {
  it('classifies audio and video paths', () => {
    expect(mediaPlaybackKind('C:/a/track.mp3')).toBe('audio')
    expect(mediaPlaybackKind('/tmp/clip.MP4')).toBe('video')
    expect(mediaPlaybackKind('/tmp/readme.txt')).toBe('unknown')
    expect(prefersVideoElement('/a.mp3', '/b.webm')).toBe(true)
    expect(prefersVideoElement('/a.flac', '/b.wav')).toBe(false)
  })
})
