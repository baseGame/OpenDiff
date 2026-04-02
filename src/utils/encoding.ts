/**
 * File encoding detection utility
 * Detects charset from raw bytes using BOM and heuristic analysis
 */

export interface DetectedEncoding {
  name: string
  confidence: number
  label: string
}

export const SUPPORTED_ENCODINGS = [
  'UTF-8', 'GBK', 'GB2312', 'BIG5', 'SHIFT-JIS',
  'EUC-KR', 'ISO-8859-1', 'WINDOWS-1252', 'UTF-16LE', 'UTF-16BE', 'ASCII',
]

const BOM: Record<string, number[]> = {
  'UTF-8':    [0xEF, 0xBB, 0xBF],
  'UTF-16LE': [0xFF, 0xFE],
  'UTF-16BE': [0xFE, 0xFF],
}

export function detectEncoding(bytes: Uint8Array): DetectedEncoding {
  if (bytes.length < 2) return { name: 'UTF-8', confidence: 0.5, label: 'UTF-8 (small file)' }

  // Check BOM
  for (const [name, sig] of Object.entries(BOM)) {
    if (bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b)) {
      return { name, confidence: 1.0, label: `${name} (BOM)` }
    }
  }

  // Check UTF-8 validity
  const utfResult = validateUtf8(bytes)
  if (utfResult.valid && utfResult.nonAsciiRatio > 0.05) {
    return { name: 'UTF-8', confidence: 0.9, label: `UTF-8 (${utfResult.validRatioPct}% valid)` }
  }
  if (utfResult.nonAsciiRatio <= 0.02) {
    return { name: 'ASCII', confidence: 0.95, label: 'ASCII (pure)' }
  }

  // Heuristic: try each encoding and score
  const sample = bytes.slice(0, 2048)
  let best: { name: string; score: number } = { name: 'ISO-8859-1', score: 0.3 }

  for (const enc of ['GBK', 'BIG5', 'SHIFT-JIS', 'EUC-KR']) {
    try {
      const decoded = new TextDecoder(enc, { fatal: false }).decode(sample)
      const reEncoded = new TextEncoder().encode(decoded)
      const ratio = reEncoded.length / Math.max(sample.length, 1)
      if (ratio > 0.85 && ratio < 1.15) {
        return { name: enc, confidence: 0.75, label: `${enc} (auto-detected)` }
      }
      if (ratio > best.score) best = { name: enc, score: ratio }
    } catch { /* skip */ }
  }

  return { name: best.name, confidence: 0.3, label: `${best.name} (fallback)` }
}

function validateUtf8(bytes: Uint8Array): { valid: boolean; validRatioPct: number; nonAsciiRatio: number } {
  let valid = 0, invalid = 0, nonAscii = 0
  const limit = Math.min(bytes.length, 8192)
  for (let i = 0; i < limit; i++) {
    const b = bytes[i]
    if (b < 0x80) {
      valid++
    } else if ((b & 0xE0) === 0xC0) {
      if (i + 1 < limit && (bytes[i + 1] & 0xC0) === 0x80) { valid++; i++ } else { invalid++ }
    } else if ((b & 0xF0) === 0xE0) {
      if (i + 2 < limit && (bytes[i + 1] & 0xC0) === 0x80 && (bytes[i + 2] & 0xC0) === 0x80) { valid++; i += 2 } else { invalid++ }
    } else if ((b & 0xF8) === 0xF0) {
      if (i + 3 < limit && (bytes[i + 1] & 0xC0) === 0x80 && (bytes[i + 2] & 0xC0) === 0x80 && (bytes[i + 3] & 0xC0) === 0x80) { valid++; i += 3 } else { invalid++ }
    } else {
      invalid++
    }
    if (b >= 0x80) nonAscii++
  }
  const total = valid + invalid || 1
  return { valid: invalid === 0, validRatioPct: Math.round((valid / total) * 100), nonAsciiRatio: nonAscii / total }
}

export function decodeWithEncoding(bytes: Uint8Array, encoding: string): string {
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(bytes)
  } catch {
    return new TextDecoder('ISO-8859-1', { fatal: false }).decode(bytes)
  }
}
