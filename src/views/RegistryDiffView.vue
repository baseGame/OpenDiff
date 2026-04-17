<template>
  <div class="registry-diff-container">
    <div class="toolbar">
      <div class="toolbar-group">
        <button @click="loadRegistryHives" class="btn btn-primary">Load Registry</button>
        <button @click="exportDiff" class="btn btn-secondary">Export Diff</button>
      </div>
      <div class="toolbar-group">
        <label><input type="checkbox" v-model="showOnlyDifferences" /> Only Differences</label>
        <input type="text" v-model="searchQuery" placeholder="Search keys..." class="search-input" />
        <select v-model="viewMode" class="view-mode-select">
          <option value="tree">Tree View</option>
          <option value="side-by-side">Side by Side</option>
        </select>
      </div>
    </div>

    <div class="main-content">
      <div class="panel left-panel">
        <div class="panel-header">
          <h3>Left Registry</h3>
          <span class="badge">{{ leftStats.totalKeys }} keys, {{ leftStats.totalValues }} values</span>
        </div>
        <div class="panel-content">
          <RegistryTreeView :data="leftRegistryData" :highlighted-keys="highlightedKeys" :selected-key="selectedKey" @select="onLeftSelect" />
        </div>
      </div>

      <div class="panel center-panel">
        <div class="panel-header">
          <h3>Diff Details</h3>
          <span class="badge diff-count">+{{ diffStats.added }} -{{ diffStats.removed }} ~{{ diffStats.modified }}</span>
        </div>
        <div class="panel-content">
          <div v-if="!selectedKey" class="empty-state"><p>Select a registry key to view differences</p></div>
          <div v-else class="diff-details">
            <div class="key-info">
              <h4>{{ selectedKey.path }}</h4>
              <span :class="['diff-type', selectedKey.diffType]">{{ getDiffTypeLabel(selectedKey.diffType) }}</span>
            </div>
            <div class="values-list">
              <div v-for="value in selectedKey.values" :key="value.name" :class="['value-item', getValueDiffClass(value)]">
                <div class="value-header">
                  <span class="value-name">{{ value.name }}</span>
                  <span class="value-type">{{ value.type }}</span>
                </div>
                <div class="value-content">
                  <div v-if="value.left !== undefined" class="value-left"><span class="label">L:</span><span class="data">{{ formatValue(value.left, value.type) }}</span></div>
                  <div v-if="value.right !== undefined" class="value-right"><span class="label">R:</span><span class="data">{{ formatValue(value.right, value.type) }}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel right-panel">
        <div class="panel-header">
          <h3>Right Registry</h3>
          <span class="badge">{{ rightStats.totalKeys }} keys, {{ rightStats.totalValues }} values</span>
        </div>
        <div class="panel-content">
          <RegistryTreeView :data="rightRegistryData" :highlighted-keys="highlightedKeys" :selected-key="selectedKey" @select="onRightSelect" />
        </div>
      </div>
    </div>

    <div class="status-bar">
      <span>Mode: {{ viewMode }}</span>
      <span v-if="isLoading">Loading...</span>
      <span v-else>Ready | {{ lastUpdateTime }}</span>
    </div>
  </div>
</template>

<script>
import RegistryTreeView from '../components/RegistryTreeView.vue'
import { registryService } from '../services/registryService'

export default {
  name: 'RegistryDiffView',
  components: { RegistryTreeView },
  data() {
    return {
      leftRegistryData: null, rightRegistryData: null, selectedKey: null,
      highlightedKeys: new Set(), showOnlyDifferences: false, searchQuery: '',
      viewMode: 'tree', isLoading: false, lastUpdateTime: null,
      leftStats: { totalKeys: 0, totalValues: 0 },
      rightStats: { totalKeys: 0, totalValues: 0 },
      diffStats: { added: 0, removed: 0, modified: 0 }
    }
  },
  mounted() { this.loadRegistryHives() },
  methods: {
    async loadRegistryHives() {
      this.isLoading = true
      try {
        const [leftData, rightData] = await Promise.all([
          registryService.loadRegistry('left'),
          registryService.loadRegistry('right')
        ])
        this.leftRegistryData = leftData
        this.rightRegistryData = rightData
        this.leftStats = this.calculateStats(leftData)
        this.rightStats = this.calculateStats(rightData)
        this.calculateDifferences()
        this.lastUpdateTime = new Date().toLocaleTimeString()
        this.$message.success('Registry loaded successfully')
      } catch (error) {
        console.error('Failed to load registry:', error)
        this.$message.error('Failed to load registry: ' + error.message)
      } finally { this.isLoading = false }
    },
    calculateStats(data) {
      let totalKeys = 0, totalValues = 0
      const traverse = (node) => {
        if (!node) return
        totalKeys++
        totalValues += node.values?.length || 0
        node.children?.forEach(traverse)
      }
      traverse(data)
      return { totalKeys, totalValues }
    },
    calculateDifferences() {
      const diffs = []
      const compareNodes = (left, right, path = '') => {
        if (!left && !right) return
        const currentPath = path || left?.path || right?.path
        let diffType = 'unchanged'
        if (left && !right) diffType = 'removed'
        else if (!left && right) diffType = 'added'
        else if (this.valuesChanged(left, right)) diffType = 'modified'
        
        const allValues = new Map()
        left?.values?.forEach(v => allValues.set(v.name, { ...v, side: 'left' }))
        right?.values?.forEach(v => {
          if (allValues.has(v.name)) {
            const existing = allValues.get(v.name)
            existing.right = v.data
            existing.diffType = existing.data !== v.data ? 'modified' : 'unchanged'
          } else {
            allValues.set(v.name, { ...v, side: 'right', diffType: 'added' })
          }
        })
        
        diffs.push({ path: currentPath, diffType, values: Array.from(allValues.values()) })
        if (diffType !== 'unchanged') this.highlightedKeys.add(currentPath)
        
        const leftChildren = left?.children || []
        const rightChildren = right?.children || []
        const allChildPaths = new Set([...leftChildren.map(c => c.name), ...rightChildren.map(c => c.name)])
        
        allChildPaths.forEach(childName => {
          const leftChild = leftChildren.find(c => c.name === childName)
          const rightChild = rightChildren.find(c => c.name === childName)
          compareNodes(leftChild, rightChild, currentPath ? `${currentPath}\\${childName}` : childName)
        })
      }
      
      compareNodes(this.leftRegistryData, this.rightRegistryData)
      this.diffStats = {
        added: diffs.filter(d => d.diffType === 'added').length,
        removed: diffs.filter(d => d.diffType === 'removed').length,
        modified: diffs.filter(d => d.diffType === 'modified').length
      }
    },
    valuesChanged(left, right) {
      if (!left?.values || !right?.values) return false
      if (left.values.length !== right.values.length) return true
      const leftMap = new Map(left.values.map(v => [v.name, v.data]))
      return right.values.some(v => leftMap.get(v.name) !== v.data)
    },
    onLeftSelect(key) { this.selectedKey = key; this.syncSelection('left', key) },
    onRightSelect(key) { this.selectedKey = key; this.syncSelection('right', key) },
    syncSelection(side, key) {
      const targetData = side === 'left' ? this.rightRegistryData : this.leftRegistryData
      const correspondingKey = this.findKeyByPath(targetData, key.path)
      if (correspondingKey) {
        this.selectedKey = { ...key, left: side === 'left' ? key : correspondingKey, right: side === 'right' ? key : correspondingKey }
      }
    },
    findKeyByPath(root, path) {
      if (!root || !path) return null
      if (root.path === path) return root
      for (const child of root.children || []) {
        const found = this.findKeyByPath(child, path)
        if (found) return found
      }
      return null
    },
    getDiffTypeLabel(type) {
      const labels = { added: 'Added', removed: 'Removed', modified: 'Modified', unchanged: 'Unchanged' }
      return labels[type] || type
    },
    getValueDiffClass(value) { return `value-${value.diffType || 'unchanged'}` },
    formatValue(data, type) {
      if (data === null || data === undefined) return '(empty)'
      switch (type) {
        case 'REG_SZ': case 'REG_EXPAND_SZ': return String(data)
        case 'REG_DWORD': return `0x${data.toString(16).toUpperCase()} (${data})`
        case 'REG_QWORD': return `0x${data.toString(16).toUpperCase()}`
        case 'REG_BINARY': return Array.isArray(data) ? data.map(b => b.toString(16).padStart(2, '0')).join(' ') : String(data)
        case 'REG_MULTI_SZ': return Array.isArray(data) ? data.join('\\n') : String(data)
        default: return String(data)
      }
    },
    exportDiff() {
      const diffData = this.getAllDifferences()
      const blob = new Blob([JSON.stringify(diffData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `registry-diff-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      this.$message.success('Diff exported successfully')
    },
    getAllDifferences() {
      const diffs = []
      const traverse = (node, side) => {
        if (!node) return
        diffs.push({ ...node, side })
        node.children?.forEach(child => traverse(child, side))
      }
      traverse(this.leftRegistryData, 'left')
      traverse(this.rightRegistryData, 'right')
      return diffs
    }
  }
}
</script>

<style scoped>
.registry-diff-container { display: flex; flex-direction: column; height: 100%; background: var(--bg-primary); }
.toolbar { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); gap: 16px; flex-wrap: wrap; }
.toolbar-group { display: flex; align-items: center; gap: 8px; }
.btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
.btn-primary { background: var(--primary-color); color: white; }
.btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); }
.search-input { padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); width: 200px; }
.view-mode-select { padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); }
.main-content { display: flex; flex: 1; overflow: hidden; }
.panel { display: flex; flex-direction: column; border-right: 1px solid var(--border-color); }
.left-panel, .right-panel { flex: 1; background: var(--bg-primary); }
.center-panel { flex: 1.5; background: var(--bg-secondary); }
.panel-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--bg-tertiary); border-bottom: 1px solid var(--border-color); }
.panel-header h3 { margin: 0; font-size: 14px; }
.badge { padding: 4px 8px; background: var(--bg-primary); border-radius: 12px; font-size: 12px; }
.badge.diff-count { background: var(--primary-color); color: white; }
.panel-content { flex: 1; overflow: auto; padding: 12px; }
.empty-state { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); }
.diff-details { display: flex; flex-direction: column; gap: 16px; }
.key-info { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--primary-color); }
.key-info h4 { margin: 0; font-size: 14px; font-family: monospace; word-break: break-all; }
.diff-type { padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }
.diff-type.added { background: #d4edda; color: #155724; }
.diff-type.removed { background: #f8d7da; color: #721c24; }
.diff-type.modified { background: #fff3cd; color: #856404; }
.diff-type.unchanged { background: #e2e3e5; color: #383d41; }
.values-list { display: flex; flex-direction: column; gap: 8px; }
.value-item { padding: 12px; background: var(--bg-primary); border-radius: 6px; border: 1px solid var(--border-color); }
.value-item.value-added { border-left: 3px solid #28a745; }
.value-item.value-removed { border-left: 3px solid #dc3545; }
.value-item.value-modified { border-left: 3px solid #ffc107; }
.value-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.value-name { font-weight: 600; font-family: monospace; }
.value-type { font-size: 12px; background: var(--bg-tertiary); padding: 2px 6px; border-radius: 3px; }
.value-content { display: flex; flex-direction: column; gap: 6px; }
.value-left, .value-right { display: flex; gap: 8px; font-size: 13px; }
.label { color: var(--text-secondary); font-weight: 500; }
.data { font-family: monospace; word-break: break-all; }
.status-bar { display: flex; justify-content: space-between; padding: 8px 16px; background: var(--bg-tertiary); border-top: 1px solid var(--border-color); font-size: 12px; }
</style>
