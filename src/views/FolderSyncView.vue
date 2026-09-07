<script setup lang="ts">
import { executeFolderSync, previewFolderSync } from '@/api/sync'
import type {
  FolderSyncActionOverride,
  FolderSyncExecutionLog,
  FolderSyncOverrideAction,
  FolderSyncPreviewAction,
  FolderSyncPreviewRow,
  FolderSyncStrategy,
} from '@/types/sync'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import { createFolderSnapshot } from '@/api/diff'
import { collectExpandablePrefixes, isPathHiddenByCollapse } from '@/app/folderPathGroups'
import { buildFolderSyncToolbar, pathBaseName, syncPathPairTitle } from '@/app/sessionToolbars'
import { useI18n } from '@/i18n'
import { useTabsStore } from '@/stores/tabs'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useViewActionsStore } from '@/stores/viewActions'

interface SyncStrategyOption {
  value: FolderSyncStrategy
  labelKey: string
}

interface SyncPreviewRow {
  id: string
  relativePath: string
  action: FolderSyncPreviewAction
  plannedAction: FolderSyncOverrideAction
  overrideAction: FolderSyncOverrideAction
  sourcePath?: string
  targetPath?: string
  detail: string
}

const overrideOptions: { value: FolderSyncOverrideAction; labelKey: string }[] = [
  { value: 'leave', labelKey: 'ui.leave' },
  { value: 'copyLeftToRight', labelKey: 'ui.copyLeftToRight' },
  { value: 'copyRightToLeft', labelKey: 'ui.copyRightToLeft' },
  { value: 'delete', labelKey: 'ui.delete' },
]

const strategyOptions: SyncStrategyOption[] = [
  { value: 'updateRight', labelKey: 'sync.strategy.updateRight' },
  { value: 'updateLeft', labelKey: 'sync.strategy.updateLeft' },
  { value: 'updateBoth', labelKey: 'sync.strategy.updateBoth' },
  { value: 'mirrorRight', labelKey: 'sync.strategy.mirrorRight' },
  { value: 'mirrorLeft', labelKey: 'sync.strategy.mirrorLeft' },
]
const { t } = useI18n()
const tabs = useTabsStore()
const router = useRouter()
const sessionLaunch = useSessionLaunchStore()
const viewActions = useViewActionsStore()
const leftPath = ref('')
const rightPath = ref('')
const selectedStrategy = ref<FolderSyncStrategy>('updateBoth')
const previewName = ref('')
const previewLoading = ref(false)
const previewError = ref<string>()
const syncRunning = ref(false)
const syncRunError = ref<string>()
const previewRows = ref<SyncPreviewRow[]>([])
const completedOperations = ref(0)
const syncLogs = ref<string[]>([])
const planAccepted = ref(false)
const syncChromeMessage = ref('')
const collapsedPrefixes = ref<Set<string>>(new Set())
const showSyncFilters = ref(false)
const showSyncSelect = ref(false)
const checkedRowIds = ref<Set<string>>(new Set())
const visibleActions = ref<Set<FolderSyncPreviewAction>>(
  new Set(['Copy', 'Delete', 'Leave', 'Conflict']),
)
const lastSelectionAction = ref('')

const selectedStrategyLabel = computed(() =>
  t(
    strategyOptions.find((option) => option.value === selectedStrategy.value)?.labelKey ??
      'sync.strategy.updateBoth',
  ),
)
const canRunSync = computed(
  () => previewRows.value.length > 0 && planAccepted.value && !syncRunning.value,
)
const overriddenRowCount = computed(
  () => previewRows.value.filter((row) => row.overrideAction !== row.plannedAction).length,
)
const syncSessionTitle = computed(() => {
  if (leftPath.value && rightPath.value) {
    return syncPathPairTitle(leftPath.value, rightPath.value)
  }

  return t('ui.folderSync')
})
const filteredPreviewRows = computed(() =>
  previewRows.value.filter((row) => visibleActions.value.has(row.action)),
)
const visiblePreviewRows = computed(() =>
  filteredPreviewRows.value.filter(
    (row) => !isPathHiddenByCollapse(row.relativePath, collapsedPrefixes.value),
  ),
)
const syncSessionToolbar = computed(() =>
  buildFolderSyncToolbar({
    home: true,
    expand: previewRows.value.length > 0,
    collapse: previewRows.value.length > 0,
    select: previewRows.value.length > 0,
    filters: previewRows.value.length > 0,
    refresh: Boolean(leftPath.value && rightPath.value) && !previewLoading.value,
    swap: Boolean(leftPath.value || rightPath.value),
    stop: previewLoading.value || syncRunning.value,
  }),
)

function goHomeFromSync(): void {
  tabs.openTab({ title: 'Home', titleKey: 'ui.home', route: '/', dirty: false })
  void router.push('/')
}

function expandAllSyncPaths(): void {
  collapsedPrefixes.value = new Set()
}

function collapseAllSyncPaths(): void {
  collapsedPrefixes.value = new Set(
    collectExpandablePrefixes(previewRows.value.map((row) => row.relativePath)),
  )
}

function toggleSyncActionFilter(action: FolderSyncPreviewAction): void {
  const next = new Set(visibleActions.value)

  if (next.has(action)) {
    next.delete(action)
  } else {
    next.add(action)
  }

  visibleActions.value = next
}

function selectVisibleSyncRows(): void {
  checkedRowIds.value = new Set(visiblePreviewRows.value.map((row) => row.id))
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: checkedRowIds.value.size,
    action: t('ui.selectAll'),
  })
}

function clearSyncSelection(): void {
  checkedRowIds.value = new Set()
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: 0,
    action: t('ui.clearSelection'),
  })
}

function invertSyncSelection(): void {
  const next = new Set(checkedRowIds.value)

  for (const row of visiblePreviewRows.value) {
    if (next.has(row.id)) {
      next.delete(row.id)
    } else {
      next.add(row.id)
    }
  }

  checkedRowIds.value = next
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: next.size,
    action: t('ui.invertSelection'),
  })
}

function toggleSyncRowChecked(rowId: string): void {
  const next = new Set(checkedRowIds.value)

  if (next.has(rowId)) {
    next.delete(rowId)
  } else {
    next.add(rowId)
  }

  checkedRowIds.value = next
}

function stopSyncWork(): void {
  syncChromeMessage.value = t('ui.stop')
}

function runSyncToolbarCommand(commandId: string): void {
  switch (commandId) {
    case 'home':
      goHomeFromSync()
      break
    case 'expand':
      expandAllSyncPaths()
      break
    case 'collapse':
      collapseAllSyncPaths()
      break
    case 'select':
      showSyncSelect.value = !showSyncSelect.value
      break
    case 'filters':
      showSyncFilters.value = !showSyncFilters.value
      break
    case 'refresh':
      void previewSync()
      break
    case 'swap':
      swapSyncPaths()
      break
    case 'stop':
      stopSyncWork()
      break
    default:
      break
  }
}

onMounted(() => {
  const launch = sessionLaunch.consumeLaunch('/sync/folder')

  if (!launch) {
    return
  }

  leftPath.value = launch.locations.left?.uri ?? leftPath.value
  rightPath.value = launch.locations.right?.uri ?? rightPath.value

  if (launch.autoRun && launch.locations.left?.uri && launch.locations.right?.uri) {
    void previewSync()
  }
})

async function previewSync(): Promise<void> {
  previewLoading.value = true
  previewError.value = undefined

  try {
    const response = await previewFolderSync({
      leftRoot: leftPath.value,
      rightRoot: rightPath.value,
      strategy: selectedStrategy.value,
    })

    previewName.value = response.name
    previewRows.value = response.rows.map(syncPreviewResponseRowToViewRow)
    leftPath.value = response.leftRoot
    rightPath.value = response.rightRoot
    completedOperations.value = 0
    syncLogs.value = []
    syncRunError.value = undefined
    planAccepted.value = false
    syncChromeMessage.value = ''
    collapsedPrefixes.value = new Set()
    checkedRowIds.value = new Set()
    lastSelectionAction.value = ''
  } catch (error) {
    previewError.value = error instanceof Error ? error.message : String(error)
  } finally {
    previewLoading.value = false
  }
}

async function runSync(): Promise<void> {
  if (!canRunSync.value) {
    return
  }

  syncRunning.value = true
  syncRunError.value = undefined

  try {
    const response = await executeFolderSync({
      leftRoot: leftPath.value,
      rightRoot: rightPath.value,
      strategy: selectedStrategy.value,
      overrides: currentOverrides(),
    })

    completedOperations.value = response.succeeded + response.failed + response.cancelled
    syncLogs.value = response.logs.map(folderSyncExecutionLogLabel)
  } catch (error) {
    syncRunError.value = error instanceof Error ? error.message : String(error)
  } finally {
    syncRunning.value = false
  }
}

function currentOverrides(): FolderSyncActionOverride[] {
  return previewRows.value.map((row) => ({
    relativePath: row.relativePath,
    action: row.overrideAction,
  }))
}

function plannedOverride(
  row: FolderSyncPreviewRow,
  leftRoot: string,
  rightRoot: string,
): FolderSyncOverrideAction {
  if (row.action === 'Delete') {
    return 'delete'
  }

  if (row.action === 'Leave' || row.action === 'Conflict') {
    return 'leave'
  }

  const source = row.sourcePath ?? ''

  if (source.startsWith(rightRoot)) {
    return 'copyRightToLeft'
  }

  if (source.startsWith(leftRoot)) {
    return 'copyLeftToRight'
  }

  return 'copyLeftToRight'
}

function folderSyncActionLabel(action: FolderSyncPreviewAction): string {
  const keys: Record<FolderSyncPreviewAction, string> = {
    Conflict: 'ui.conflicts',
    Copy: 'ui.copy',
    Delete: 'ui.delete',
    Leave: 'ui.leave',
  }

  return t(keys[action])
}

function syncPreviewResponseRowToViewRow(row: FolderSyncPreviewRow): SyncPreviewRow {
  const planned = plannedOverride(row, leftPath.value, rightPath.value)

  return {
    id: row.id,
    relativePath: row.relativePath,
    action: row.action,
    plannedAction: planned,
    overrideAction: planned,
    sourcePath: row.sourcePath,
    targetPath: row.targetPath,
    detail: row.detail,
  }
}

function acceptSyncPlan(): void {
  for (const row of previewRows.value) {
    row.overrideAction = row.plannedAction
  }
  planAccepted.value = true
  syncChromeMessage.value = t('status.syncPlanAccepted')
}

function cancelSyncOverrides(): void {
  for (const row of previewRows.value) {
    row.overrideAction = 'leave'
  }
  planAccepted.value = false
  syncChromeMessage.value = t('status.syncPlanCancelled')
}

function resetRowOverride(row: SyncPreviewRow): void {
  row.overrideAction = row.plannedAction
}

function folderSyncExecutionLogLabel(log: FolderSyncExecutionLog): string {
  if (log.status === 'failed') {
    return `${log.relativePath} -> ${log.error ?? log.status}`
  }

  if (log.action === 'delete') {
    return t('status.deletedPath', { path: log.relativePath })
  }

  if (log.action === 'leave') {
    return `${t('ui.leave')} -> ${log.relativePath}`
  }

  if (log.action === 'conflict') {
    return `${t('ui.conflicts')} -> ${log.relativePath}`
  }

  return t('status.copiedPath', { path: log.relativePath })
}

watch(
  [leftPath, rightPath],
  ([left, right]) => {
    if (left && right) {
      tabs.setTabTitle('/sync/folder', syncPathPairTitle(left, right))
    }
  },
  { immediate: true },
)

function swapSyncPaths(): void {
  const nextLeft = rightPath.value

  rightPath.value = leftPath.value
  leftPath.value = nextLeft
}

async function saveSyncFolderSnapshot(): Promise<void> {
  const sourceRoot = leftPath.value.trim()

  if (!sourceRoot) {
    return
  }

  const normalizedRoot = sourceRoot.replace(/[/\\]+$/u, '')
  const outputPath = `${normalizedRoot}/open-diff-snapshot.json`

  try {
    await createFolderSnapshot({
      sourceRoot: normalizedRoot,
      outputPath,
      name: pathBaseName(normalizedRoot),
    })
  } catch {
    // ponytail: folder sync snapshot best-effort
  }
}

watch(
  () => [viewActions.sequence, viewActions.name] as const,
  ([, actionName]) => {
    if (!actionName) {
      return
    }

    switch (actionName) {
      case 'compare':
        void previewSync()
        break
      case 'save-snapshot':
        void saveSyncFolderSnapshot()
        break
      case 'reload':
        void previewSync()
        break
      case 'swap':
        swapSyncPaths()
        break
      case 'save':
        void runSync()
        break
      case 'about':
      case 'check-for-updates':
      case 'close-tab':
      case 'copy':
      case 'copy-left':
      case 'copy-right':
      case 'cut':
      case 'delete':
      case 'export':
      case 'export-settings':
      case 'filters':
        showSyncFilters.value = !showSyncFilters.value
        break
      case 'help-contents':
      case 'help-support':
      case 'import-settings':
      case 'next-difference':
      case 'paste':
      case 'previous-difference':
      case 'redo':
      case 'restore-factory-defaults':
      case 'rules':
      case 'save-as':
      case 'session-settings':
      case 'show-all':
      case 'show-differences':
      case 'undo':
      case 'workspace-load':
      case 'workspace-save':
        break
    }
  },
)
</script>

<template>
  <WorkbenchShell
    :title="syncSessionTitle"
    :eyebrow="$t('ui.sync')"
    :subtitle="selectedStrategyLabel"
    :inspector-label="$t('ui.folderSyncInspector')"
    :toolbar-commands="syncSessionToolbar"
    toolbar-test-id-prefix="folder-sync-session-toolbar"
    @toolbar-command="runSyncToolbarCommand"
  >
    <section class="folder-sync-view">
      <header class="folder-sync-header">
        <div>
          <p class="eyebrow">{{ $t('ui.folderSync') }}</p>
          <h1 data-testid="folder-sync-title">{{ syncSessionTitle }}</h1>
        </div>
        <div class="sync-progress">
          <strong>{{ completedOperations }} / {{ previewRows.length }}</strong>
          <span>{{ $t('ui.completed') }}</span>
        </div>
      </header>

      <section class="sync-settings">
        <label>
          <span>{{ $t('ui.leftFolder') }}</span>
          <input
            v-model="leftPath"
            data-testid="folder-sync-left-path"
          />
        </label>
        <label>
          <span>{{ $t('ui.rightFolder') }}</span>
          <input
            v-model="rightPath"
            data-testid="folder-sync-right-path"
          />
        </label>
        <label>
          <span>{{ $t('ui.strategy') }}</span>
          <select
            v-model="selectedStrategy"
            data-testid="folder-sync-strategy"
          >
            <option
              v-for="option in strategyOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ $t(option.labelKey) }}
            </option>
          </select>
        </label>
        <div class="sync-setting-actions">
          <NButton
            size="small"
            secondary
            data-testid="folder-sync-preview"
            :disabled="previewLoading || !leftPath || !rightPath"
            :loading="previewLoading"
            @click="previewSync"
            >{{ $t('ui.preview') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="folder-sync-accept"
            :disabled="previewRows.length === 0 || syncRunning"
            @click="acceptSyncPlan"
            >{{ $t('ui.accept') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="folder-sync-cancel"
            :disabled="previewRows.length === 0 || syncRunning"
            @click="cancelSyncOverrides"
            >{{ $t('ui.cancel') }}</NButton
          >
          <NButton
            size="small"
            type="primary"
            data-testid="folder-sync-run"
            :disabled="!canRunSync"
            :loading="syncRunning"
            @click="runSync"
            >{{ $t('ui.syncNow') }}</NButton
          >
        </div>
      </section>

      <section
        v-if="previewError"
        class="sync-run-status"
        data-testid="folder-sync-preview-error"
      >
        {{ previewError }}
      </section>

      <section
        v-if="syncRunError"
        class="sync-run-status"
        data-testid="folder-sync-run-error"
      >
        {{ syncRunError }}
      </section>

      <section
        v-if="syncChromeMessage"
        class="sync-run-status"
        data-testid="folder-sync-chrome-status"
      >
        {{ syncChromeMessage }}
        <span v-if="planAccepted">
          · {{ $t('status.overrideCount', { count: overriddenRowCount }) }}</span
        >
      </section>

      <section
        v-if="showSyncFilters && previewRows.length > 0"
        class="sync-chrome-panel"
        data-testid="folder-sync-filters-panel"
      >
        <strong>{{ $t('ui.filters') }}</strong>
        <label
          v-for="action in ['Copy', 'Delete', 'Leave', 'Conflict'] as const"
          :key="action"
        >
          <input
            type="checkbox"
            :checked="visibleActions.has(action)"
            :data-testid="`folder-sync-filter-${action}`"
            @change="toggleSyncActionFilter(action)"
          />
          <span>{{ folderSyncActionLabel(action) }}</span>
        </label>
      </section>

      <section
        v-if="showSyncSelect && previewRows.length > 0"
        class="sync-chrome-panel"
        data-testid="folder-sync-select-panel"
      >
        <strong>{{ $t('ui.select') }}</strong>
        <button
          type="button"
          data-testid="folder-sync-select-all"
          @click="selectVisibleSyncRows"
        >
          {{ $t('ui.selectAll') }}
        </button>
        <button
          type="button"
          data-testid="folder-sync-select-invert"
          @click="invertSyncSelection"
        >
          {{ $t('ui.invertSelection') }}
        </button>
        <button
          type="button"
          data-testid="folder-sync-select-clear"
          @click="clearSyncSelection"
        >
          {{ $t('ui.clearSelection') }}
        </button>
        <span
          v-if="lastSelectionAction"
          data-testid="folder-sync-selection-status"
          >{{ lastSelectionAction }}</span
        >
      </section>

      <section
        v-if="previewRows.length > 0"
        class="sync-preview"
        data-testid="folder-sync-preview-panel"
      >
        <header>
          <strong>{{ previewName || selectedStrategyLabel }}</strong>
          <span>{{ leftPath }} -> {{ rightPath }}</span>
          <em data-testid="folder-sync-accept-state">{{
            planAccepted ? $t('status.syncPlanAccepted') : $t('status.syncPlanPending')
          }}</em>
        </header>
        <div class="sync-preview-table">
          <div class="sync-preview-row sync-preview-head">
            <span>{{ $t('ui.select') }}</span>
            <span>{{ $t('ui.plannedAction') }}</span>
            <span>{{ $t('ui.override') }}</span>
            <span>{{ $t('ui.source') }}</span>
            <span>{{ $t('ui.target') }}</span>
            <span>{{ $t('ui.detail') }}</span>
          </div>
          <div
            v-for="row in visiblePreviewRows"
            :key="row.id"
            class="sync-preview-row"
            :class="{
              'sync-row-overridden': row.overrideAction !== row.plannedAction,
              'sync-row-selected': checkedRowIds.has(row.id),
            }"
            :data-testid="`sync-row-${row.id}`"
          >
            <label class="sync-select-cell">
              <input
                type="checkbox"
                :checked="checkedRowIds.has(row.id)"
                :data-testid="`sync-check-${row.id}`"
                @change="toggleSyncRowChecked(row.id)"
              />
            </label>
            <span :data-testid="`sync-planned-${row.id}`">{{
              $t(
                overrideOptions.find((option) => option.value === row.plannedAction)?.labelKey ??
                  'ui.leave',
              )
            }}</span>
            <label class="sync-override-cell">
              <span class="sr-only">{{ folderSyncActionLabel(row.action) }}</span>
              <select
                v-model="row.overrideAction"
                :data-testid="`sync-override-${row.id}`"
                @change="planAccepted = false"
              >
                <option
                  v-for="option in overrideOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ $t(option.labelKey) }}
                </option>
              </select>
              <button
                type="button"
                class="sync-reset-override"
                :data-testid="`sync-reset-${row.id}`"
                :disabled="row.overrideAction === row.plannedAction"
                @click="resetRowOverride(row)"
              >
                {{ $t('ui.reset') }}
              </button>
            </label>
            <span>{{ row.sourcePath ?? '--' }}</span>
            <span>{{ row.targetPath ?? '--' }}</span>
            <span>{{ row.detail }}</span>
          </div>
        </div>
      </section>

      <section
        v-if="completedOperations > 0"
        class="sync-run-status"
        data-testid="folder-sync-run-status"
      >
        <strong>{{
          $t('status.completedCount', { count: completedOperations, total: previewRows.length })
        }}</strong>
        <ul>
          <li
            v-for="log in syncLogs"
            :key="log"
          >
            {{ log }}
          </li>
        </ul>
      </section>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.syncPreview') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.strategy') }}</dt>
              <dd>{{ selectedStrategyLabel }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.items') }}</dt>
              <dd>{{ previewRows.length }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.completed') }}</dt>
              <dd>{{ completedOperations }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.status') }}</dt>
              <dd>
                {{ previewLoading ? $t('status.running') : previewName || selectedStrategyLabel }}
              </dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
  </WorkbenchShell>
</template>
<style scoped>
.folder-sync-view {
  display: grid;
  gap: 14px;
  height: 100%;
  padding: 16px;
  overflow: auto;
}

.folder-sync-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
}

.sync-progress {
  display: grid;
  min-width: 112px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  text-align: right;
}

.sync-progress strong {
  font-size: 18px;
  line-height: 1;
}

.sync-progress span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.sync-settings {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) 180px auto;
  align-items: end;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.sync-settings label {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.sync-settings span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.sync-settings input,
.sync-settings select {
  width: 100%;
  height: 32px;
  padding: 0 9px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 13px;
}

.sync-setting-actions {
  display: flex;
  gap: 8px;
}

.sync-preview,
.sync-run-status {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.sync-preview header {
  display: grid;
  gap: 2px;
}

.sync-preview header strong,
.sync-run-status strong {
  font-size: 13px;
}

.sync-preview header span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.sync-preview-table {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 6px;
}

.sync-preview-row {
  display: grid;
  grid-template-columns:
    44px 120px minmax(200px, 1fr) minmax(160px, 1.1fr) minmax(160px, 1.1fr)
    minmax(140px, 0.9fr);
  min-width: 960px;
  border-bottom: 1px solid var(--app-border);
  font-size: 12px;
}

.sync-row-overridden {
  background: color-mix(in srgb, var(--diff-modified-bg) 55%, transparent);
}

.sync-override-cell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px 8px;
  border-right: 1px solid var(--app-border);
}

.sync-reset-override {
  min-height: 26px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  font-size: 11px;
}

.sync-reset-override:disabled {
  opacity: 0.55;
}

.sync-preview-row label {
  display: grid;
  min-width: 0;
  padding: 4px 8px;
  border-right: 1px solid var(--app-border);
}

.sync-preview-row select {
  width: 100%;
  height: 26px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-bg);
  color: var(--app-text);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.sync-preview-row:last-child {
  border-bottom: 0;
}

.sync-preview-row span,
.sync-preview-row strong {
  min-width: 0;
  padding: 8px 10px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-preview-row span:last-child {
  border-right: 0;
}

.sync-preview-head {
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-weight: 700;
}

.sync-run-status ul {
  display: grid;
  gap: 5px;
  margin: 0;
  padding-left: 18px;
  color: var(--app-text-muted);
  font-size: 12px;
}

@media (width <= 860px) {
  .folder-sync-header,
  .sync-settings {
    grid-template-columns: 1fr;
  }

  .folder-sync-header {
    display: grid;
  }

  .sync-progress {
    text-align: left;
  }
}

.sync-chrome-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.sync-chrome-panel label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.sync-chrome-panel button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  cursor: pointer;
}

.sync-select-cell {
  display: flex;
  align-items: center;
}

.sync-row-selected {
  background: color-mix(in srgb, var(--app-accent, #4c8bf5) 12%, transparent);
}
</style>
