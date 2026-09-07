import { describe, expect, it } from 'vitest'
import {
  clampHexOffset,
  formatHexOffset,
  hexOffsetForInvoke,
  isPastSigned32Bit,
  hexOffsetInputValue,
  parseHexOffset,
} from './hexOffset'

describe('hexOffset', () => {
  it('parses decimal, 0x, and trailing-h forms past 0x7FFFFFFF', () => {
    expect(parseHexOffset('2147483648')).toBe(0x8000_0000n)
    expect(parseHexOffset('0x80000000')).toBe(0x8000_0000n)
    expect(parseHexOffset('80000000h')).toBe(0x8000_0000n)
    expect(parseHexOffset('0x1_0000_0000'.replaceAll('_', ''))).toBe(0x1_0000_0000n)
    expect(isPastSigned32Bit(0x8000_0000n)).toBe(true)
  })

  it('formats and invokes with bigint-safe values', () => {
    expect(formatHexOffset(0x8000_0000n)).toBe('80000000')
    expect(hexOffsetForInvoke(0x8000_0000n)).toBe(0x8000_0000)
    expect(typeof hexOffsetForInvoke(0x8000_0000n)).toBe('number')
    expect(hexOffsetForInvoke(BigInt(Number.MAX_SAFE_INTEGER) + 16n)).toBe(
      String(BigInt(Number.MAX_SAFE_INTEGER) + 16n),
    )
    expect(clampHexOffset(-5n)).toBe(0n)
    expect(clampHexOffset(10n, 8n)).toBe(7n)
    expect(parseHexOffset(hexOffsetInputValue(0x8000_0000n))).toBe(0x8000_0000n)
  })

  it('rejects invalid offset text', () => {
    expect(parseHexOffset('')).toBeUndefined()
    expect(parseHexOffset('xyz')).toBeUndefined()
    expect(parseHexOffset('0xGG')).toBeUndefined()
  })
})
