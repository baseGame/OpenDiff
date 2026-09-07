import { describe, expect, it } from 'vitest'
import { buildRegistryReportText, defaultRegistryReportOutputPath } from './registryReport'

describe('registryReport', () => {
  it('builds a sibling registry-compare.txt path from the left export', () => {
    expect(defaultRegistryReportOutputPath('C:/regs/left.reg')).toBe('C:/regs/registry-compare.txt')
    expect(defaultRegistryReportOutputPath('/tmp/exports/a.reg')).toBe(
      '/tmp/exports/registry-compare.txt',
    )
    expect(defaultRegistryReportOutputPath('')).toBe('registry-compare.txt')
    expect(defaultRegistryReportOutputPath('solo.reg')).toBe('registry-compare.txt')
  })

  it('builds the clipboard/file REGISTRY-REPORT payload', () => {
    const text = buildRegistryReportText({
      leftPath: 'C:/regs/left.reg',
      rightPath: 'C:/regs/right.reg',
      summary: { added: 0, removed: 0, modified: 1, unchanged: 1 },
      values: [
        {
          keyPath: 'HKCU/Software/OpenDiff',
          name: 'Theme',
          left: 'REG_SZ dark',
          right: 'REG_SZ light',
          status: 'modified',
        },
        {
          keyPath: 'HKCU/Software/OpenDiff',
          name: 'Locale',
          left: 'REG_SZ en',
          right: 'REG_SZ en',
          status: 'unchanged',
        },
      ],
    })

    expect(text).toContain('REGISTRY-REPORT')
    expect(text).toContain('left: C:/regs/left.reg')
    expect(text).toContain('modified: 1')
    expect(text).toContain('HKCU/Software/OpenDiff\tTheme\tREG_SZ dark\tREG_SZ light\tmodified')
    expect(text).toContain('HKCU/Software/OpenDiff\tLocale\tREG_SZ en\tREG_SZ en\tunchanged')
  })
})
