<template>
  <div class="registry-tree">
    <div v-if="!data" class="empty-state">No registry data loaded</div>
    <div v-else>
      <TreeNode 
        :node="data" 
        :highlighted-keys="highlightedKeys"
        :selected-key="selectedKey"
        :depth="0"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { RegistryNode } from '../services/registryService'

const TreeNode = defineComponent({
  name: 'TreeNode',
  props: {
    node: { type: Object as PropType<RegistryNode>, required: true },
    highlightedKeys: { type: Set as PropType<Set<string>>, default: () => new Set() },
    selectedKey: { type: Object as PropType<RegistryNode | null>, default: null },
    depth: { type: Number, default: 0 }
  },
  emits: ['select'],
  data() {
    return { expanded: true }
  },
  computed: {
    isHighlighted(): boolean {
      return this.highlightedKeys.has(this.node.path)
    },
    isSelected(): boolean {
      return this.selectedKey?.path === this.node.path
    },
    hasChildren(): boolean {
      return this.node.children && this.node.children.length > 0
    },
    paddingLeft(): string {
      return `${this.depth * 16 + 8}px`
    }
  },
  methods: {
    toggle() {
      if (this.hasChildren) {
        this.expanded = !this.expanded
      } else {
        this.$emit('select', this.node)
      }
    },
    selectNode() {
      this.$emit('select', this.node)
    }
  },
  template: `
    <div class="tree-node">
      <div 
        :class="['node-row', { expanded, 'has-children': hasChildren, highlighted: isHighlighted, selected: isSelected }]"
        :style="{ paddingLeft }"
        @click="toggle"
      >
        <span v-if="hasChildren" class="expand-icon">{{ expanded ? '▼' : '▶' }}</span>
        <span v-else class="expand-icon"></span>
        <span class="node-name" @dblclick="selectNode">{{ node.name }}</span>
        <span v-if="node.values?.length" class="value-count">{{ node.values.length }}</span>
      </div>
      <div v-if="expanded && hasChildren" class="children">
        <TreeNode 
          v-for="child in node.children" 
          :key="child.path"
          :node="child"
          :highlighted-keys="highlightedKeys"
          :selected-key="selectedKey"
          :depth="depth + 1"
          @select="$emit('select', $event)"
        />
      </div>
    </div>
  `
})

export default defineComponent({
  name: 'RegistryTreeView',
  components: { TreeNode },
  props: {
    data: { type: Object as PropType<RegistryNode | null>, default: null },
    highlightedKeys: { type: Set as PropType<Set<string>>, default: () => new Set() },
    selectedKey: { type: Object as PropType<RegistryNode | null>, default: null }
  },
  emits: ['select']
})
</script>

<style scoped>
.registry-tree {
  font-size: 13px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
}

.tree-node {
  user-select: none;
}

.node-row {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;
}

.node-row:hover {
  background: var(--bg-hover);
}

.node-row.selected {
  background: var(--primary-color);
  color: white;
}

.node-row.highlighted {
  background: rgba(255, 193, 7, 0.3);
}

.expand-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--text-secondary);
  margin-right: 4px;
}

.node-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.value-count {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 8px;
}

.children {
  border-left: 1px solid var(--border-color);
  margin-left: 20px;
}
</style>
