/**
 * Registry Service - Windows Registry Comparison
 */

export interface RegistryNode {
  path: string
  name: string
  values: RegistryValue[]
  children: RegistryNode[]
  diffType?: 'added' | 'removed' | 'modified' | 'unchanged'
}

export interface RegistryValue {
  name: string
  type: string
  data: any
  side?: 'left' | 'right'
  diffType?: 'added' | 'removed' | 'modified' | 'unchanged'
}

class RegistryService {
  async loadRegistry(side: 'left' | 'right'): Promise<RegistryNode | null> {
    try {
      const mockData = this.generateMockRegistry(side)
      return mockData
    } catch (error) {
      console.error('Failed to load registry:', error)
      throw new Error(`Failed to load ${side} registry: ${error.message}`)
    }
  }

  async importRegFile(content: string, side: 'left' | 'right' = 'left'): Promise<void> {
    try {
      const parsed = this.parseRegFile(content)
      console.log('Imported reg file:', parsed)
    } catch (error) {
      throw new Error(`Failed to import .reg file: ${error.message}`)
    }
  }

  exportToRegFile(diffs: any[]): string {
    let content = 'Windows Registry Editor Version 5.00\n\n'
    for (const diff of diffs) {
      if (diff.diffType === 'removed') {
        content += `[-${diff.path}]\n`
      } else {
        content += `[${diff.path}]\n`
        for (const value of diff.values || []) {
          const data = value.side === 'right' ? value.right : value.left
          content += `"${value.name}"="${data}"\n`
        }
      }
      content += '\n'
    }
    return content
  }

  private generateMockRegistry(side: 'left' | 'right'): RegistryNode {
    const baseKeys = [
      {
        path: 'HKEY_CURRENT_USER\\Software\\OpenDiff',
        name: 'OpenDiff',
        values: [
          { name: 'Version', type: 'REG_SZ', data: side === 'left' ? '1.0.0' : '1.0.1' },
          { name: 'Theme', type: 'REG_SZ', data: 'dark' },
          { name: 'AutoSave', type: 'REG_DWORD', data: side === 'left' ? 0 : 1 }
        ],
        children: [
          {
            path: 'HKEY_CURRENT_USER\\Software\\OpenDiff\\Settings',
            name: 'Settings',
            values: [
              { name: 'FontSize', type: 'REG_DWORD', data: 14 },
              { name: 'ShowLineNumbers', type: 'REG_DWORD', data: 1 }
            ],
            children: []
          }
        ]
      },
      {
        path: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\OpenDiff',
        name: 'OpenDiff',
        values: [
          { name: 'InstallPath', type: 'REG_SZ', data: 'C:\\Program Files\\OpenDiff' },
          { name: 'LastUpdate', type: 'REG_SZ', data: side === 'left' ? '2024-01-01' : '2024-01-15' }
        ],
        children: side === 'right' ? [{
          path: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\OpenDiff\\Features',
          name: 'Features',
          values: [{ name: 'NewFeature', type: 'REG_DWORD', data: 1 }],
          children: []
        }] : []
      }
    ]
    return { path: 'root', name: 'root', values: [], children: baseKeys }
  }

  private parseRegFile(content: string): RegistryNode {
    const lines = content.split('\n')
    const root: RegistryNode = { path: 'root', name: 'root', values: [], children: [] }
    let currentNode: RegistryNode | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('Windows Registry Editor')) continue

      const keyMatch = trimmed.match(/^\[(.*)\]$/)
      if (keyMatch) {
        const path = keyMatch[1]
        const cleanPath = path.startsWith('-') ? path.substring(1) : path
        currentNode = { path: cleanPath, name: cleanPath.split('\\').pop(), values: [], children: [] }
        root.children.push(currentNode)
        continue
      }

      if (currentNode && trimmed.includes('=')) {
        const valueMatch = trimmed.match(/^"([^"]*)"=(.*)$/)
        if (valueMatch) {
          const name = valueMatch[1]
          const valueStr = valueMatch[2]
          const { type, data } = this.parseRegValue(valueStr)
          currentNode.values.push({ name, type, data })
        }
      }
    }
    return root
  }

  private parseRegValue(valueStr: string): { type: string; data: any } {
    if (valueStr.startsWith('dword:')) {
      return { type: 'REG_DWORD', data: parseInt(valueStr.substring(6), 16) }
    } else if (valueStr.startsWith('hex:')) {
      const hexData = valueStr.substring(4).split(',').map((h: string) => parseInt(h, 16))
      return { type: 'REG_BINARY', data: hexData }
    } else if (valueStr.startsWith('"')) {
      return { type: 'REG_SZ', data: valueStr.slice(1, -1) }
    }
    return { type: 'REG_SZ', data: valueStr }
  }
}

export const registryService = new RegistryService()
