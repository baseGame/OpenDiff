/** Hex offset helpers that stay safe past 0x7FFFFFFF and across BigInt boundaries. */

export const MAX_SAFE_HEX_OFFSET = BigInt(Number.MAX_SAFE_INTEGER)

export type HexOffsetInput = number | string | bigint

export function parseHexOffset(raw: string): bigint | undefined {
  const trimmed = raw.trim()

  if (!trimmed) {
    return undefined
  }

  try {
    if (/^0x[0-9a-f]+$/iu.test(trimmed)) {
      return BigInt(trimmed)
    }

    if (/^[0-9a-f]+h$/iu.test(trimmed)) {
      return BigInt(`0x${trimmed.slice(0, -1)}`)
    }

    if (/^\d+$/u.test(trimmed)) {
      return BigInt(trimmed)
    }
  } catch {
    return undefined
  }

  return undefined
}

export function formatHexOffset(offset: HexOffsetInput, minWidth = 8): string {
  const value = typeof offset === 'bigint' ? offset : BigInt(offset)

  if (value < 0n) {
    return '0'.padStart(minWidth, '0')
  }

  const hex = value.toString(16).toUpperCase()
  const width = Math.max(minWidth, hex.length + (hex.length % 2))

  return hex.padStart(width, '0')
}

/** Value suitable for Tauri invoke: number when safe, otherwise decimal string. */
export function hexOffsetForInvoke(offset: HexOffsetInput): number | string {
  const value = typeof offset === 'bigint' ? offset : BigInt(offset)

  if (value < 0n) {
    return 0
  }

  if (value <= MAX_SAFE_HEX_OFFSET) {
    return Number(value)
  }

  return value.toString(10)
}

export function clampHexOffset(offset: HexOffsetInput, maxExclusive?: HexOffsetInput): bigint {
  let value = typeof offset === 'bigint' ? offset : BigInt(offset)

  if (value < 0n) {
    value = 0n
  }

  if (maxExclusive !== undefined) {
    const max = typeof maxExclusive === 'bigint' ? maxExclusive : BigInt(maxExclusive)

    if (max > 0n && value >= max) {
      value = max - 1n
    }
  }

  return value
}

export function isPastSigned32Bit(offset: HexOffsetInput): boolean {
  const value = typeof offset === 'bigint' ? offset : BigInt(offset)

  return value > 0x7fff_ffffn
}

/** Canonical editable form that parseHexOffset round-trips (prefer 0x for clarity). */
export function hexOffsetInputValue(offset: HexOffsetInput): string {
  const value = typeof offset === 'bigint' ? offset : BigInt(offset)

  if (value < 0n) {
    return '0x0'
  }

  return `0x${value.toString(16).toUpperCase()}`
}
