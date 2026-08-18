import { describe, expect, it } from 'vitest'
import { createChildCompareLaunch, sessionTypeForPair } from './childSession'

describe('childSession', () => {
  it('opens a table child session for csv/tsv pairs', () => {
    const launch = createChildCompareLaunch('D:/left/data.csv', 'D:/right/data.tsv')

    expect(sessionTypeForPair('D:/left/data.csv', 'D:/right/data.tsv')).toBe('table-compare')
    expect(launch).toMatchObject({
      sessionType: 'table-compare',
      route: '/compare/table',
      autoRun: true,
      locations: {
        left: { uri: 'D:/left/data.csv' },
        right: { uri: 'D:/right/data.tsv' },
      },
    })
  })
})
