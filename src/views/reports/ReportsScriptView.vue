<script setup lang="ts">
import { computed, ref } from 'vue'
import { exportFolderCompareReport, exportTextCompareReport } from '@/api/diff'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchToolbar from '@/components/workbench/WorkbenchToolbar.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import StatusSummaryGrid from '@/components/workbench/StatusSummaryGrid.vue'
import { useI18n } from '@/i18n'
import { useLastCompareStore } from '@/stores/lastCompare'

type ReportKind = 'text' | 'folder'
type ReportFormat = 'html' | 'text' | 'json'

interface ReportJob {
  name: string
  type: string
  stateKey: string
  target: string
}

const lastCompare = useLastCompareStore()
const { t } = useI18n()
const reportKind = ref<ReportKind>(
  lastCompare.text ? 'text' : lastCompare.folder ? 'folder' : 'text',
)
const reportFormat = ref<ReportFormat>('html')
const leftPath = ref(lastCompare.text?.leftSource ?? lastCompare.folder?.leftRoot ?? '')
const rightPath = ref(lastCompare.text?.rightSource ?? lastCompare.folder?.rightRoot ?? '')
const outputPath = ref('')
const leftText = ref(lastCompare.text?.left ?? '')
const rightText = ref(lastCompare.text?.right ?? '')
const jobs = ref<ReportJob[]>([])
const running = ref(false)
const error = ref('')
const lastExport = ref('')

const completedCount = computed(
  () => jobs.value.filter((job) => job.stateKey === 'ui.completed').length,
)
const failedCount = computed(() => jobs.value.filter((job) => job.stateKey === 'ui.error').length)

async function runExport(): Promise<void> {
  running.value = true
  error.value = ''

  try {
    const extension = reportFormat.value === 'text' ? 'txt' : reportFormat.value
    const target = outputPath.value.trim() || `${reportKind.value}-compare.${extension}`

    const response =
      reportKind.value === 'folder'
        ? await exportFolderCompareReport({
            leftRoot: leftPath.value,
            rightRoot: rightPath.value,
            format: reportFormat.value,
            outputPath: target,
          })
        : await exportTextCompareReport({
            left: leftText.value || lastCompare.text?.left || '',
            right: rightText.value || lastCompare.text?.right || '',
            leftSource: leftPath.value || undefined,
            rightSource: rightPath.value || undefined,
            format: reportFormat.value,
            outputPath: target,
            algorithm: lastCompare.text?.algorithm,
            ignoreWhitespace: lastCompare.text?.ignoreWhitespace,
            ignoreCase: lastCompare.text?.ignoreCase,
            ignoreLineEndings: lastCompare.text?.ignoreLineEndings,
            ignoreRegexes: lastCompare.text?.ignoreRegexes,
          })

    lastExport.value = response.outputPath ?? target
    jobs.value = [
      {
        name: lastExport.value.split(/[\\/]/u).at(-1) ?? lastExport.value,
        type: reportFormat.value.toUpperCase(),
        stateKey: 'ui.completed',
        target: lastExport.value,
      },
      ...jobs.value,
    ]
  } catch (event) {
    error.value = String(event)
    jobs.value = [
      {
        name: t('ui.export'),
        type: reportFormat.value.toUpperCase(),
        stateKey: 'ui.error',
        target: outputPath.value || t('status.noComparisonYet'),
      },
      ...jobs.value,
    ]
  } finally {
    running.value = false
  }
}

function fillFromLastCompare(): void {
  if (reportKind.value === 'folder' && lastCompare.folder) {
    leftPath.value = lastCompare.folder.leftRoot
    rightPath.value = lastCompare.folder.rightRoot

    return
  }

  if (lastCompare.text) {
    leftPath.value = lastCompare.text.leftSource ?? ''
    rightPath.value = lastCompare.text.rightSource ?? ''
    leftText.value = lastCompare.text.left
    rightText.value = lastCompare.text.right
  }
}
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.reportsScripts')"
    :eyebrow="$t('ui.automation')"
    :subtitle="$t('ui.cliReportsAndRepeatableComparisonJobs')"
    :inspector-label="$t('ui.reportsInspector')"
  >
    <template #toolbar>
      <WorkbenchToolbar>
        <button
          type="button"
          class="primary"
          data-testid="run-report-export"
          :disabled="running"
          @click="runExport"
        >
          {{ $t('ui.runDiff') }}
        </button>
        <button
          type="button"
          data-testid="fill-last-compare"
          @click="fillFromLastCompare"
        >
          {{ $t('ui.restoreRecent') }}
        </button>
      </WorkbenchToolbar>
    </template>

    <section class="reports-script-view">
      <section class="report-panel">
        <header class="split-pane-header active">
          <strong>{{ $t('ui.jobs') }}</strong>
          <span>{{ $t('status.definitions', { count: jobs.length }) }}</span>
        </header>
        <section class="report-export-form">
          <label>
            <span>{{ $t('ui.reportKind') }}</span>
            <select
              v-model="reportKind"
              data-testid="report-kind"
            >
              <option value="text">{{ $t('ui.textCompare') }}</option>
              <option value="folder">{{ $t('ui.folderCompare') }}</option>
            </select>
          </label>
          <label>
            <span>{{ $t('ui.type') }}</span>
            <select
              v-model="reportFormat"
              data-testid="report-format"
            >
              <option value="html">{{ $t('ui.html') }}</option>
              <option value="text">{{ $t('ui.text') }}</option>
              <option value="json">{{ $t('ui.exportJson') }}</option>
            </select>
          </label>
          <label>
            <span>{{ $t('ui.leftPath') }}</span>
            <input
              v-model="leftPath"
              type="text"
              data-testid="report-left-path"
            />
          </label>
          <label>
            <span>{{ $t('ui.rightPath') }}</span>
            <input
              v-model="rightPath"
              type="text"
              data-testid="report-right-path"
            />
          </label>
          <label>
            <span>{{ $t('ui.output') }}</span>
            <input
              v-model="outputPath"
              type="text"
              data-testid="report-output-path"
            />
          </label>
        </section>
        <p
          v-if="error"
          class="report-error"
          data-testid="report-export-error"
        >
          {{ error }}
        </p>
        <p
          v-if="lastExport"
          data-testid="report-export-status"
        >
          {{ lastExport }}
        </p>
        <div
          v-if="jobs.length === 0"
          class="report-empty"
          data-testid="report-empty-jobs"
        >
          {{ $t('status.noComparisonYet') }}
        </div>
        <div
          v-else
          class="report-table"
        >
          <div class="report-row report-head">
            <span>{{ $t('ui.name') }}</span>
            <span>{{ $t('ui.type') }}</span>
            <span>{{ $t('ui.state') }}</span>
            <span>{{ $t('ui.target') }}</span>
          </div>
          <div
            v-for="job in jobs"
            :key="`${job.name}-${job.target}`"
            class="report-row"
          >
            <strong>{{ job.name }}</strong>
            <span>{{ job.type }}</span>
            <span>{{ $t(job.stateKey) }}</span>
            <code>{{ job.target }}</code>
          </div>
        </div>
      </section>

      <section class="script-panel">
        <header class="split-pane-header">
          <strong>{{ $t('ui.scriptCli') }}</strong>
          <span>{{ $t('status.noComparisonYet') }}</span>
        </header>
        <pre><code>{{ $t('ui.scriptingNotImplemented') }}</code></pre>
      </section>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.jobs') }}</h2>
          <StatusSummaryGrid
            :items="[
              { label: $t('ui.completed'), value: completedCount, tone: 'added' },
              { label: $t('ui.error'), value: failedCount, tone: 'modified' },
              { label: $t('ui.draft'), value: jobs.length === 0 ? 0 : 0 },
            ]"
          />
        </section>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.output') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.type') }}</dt>
              <dd>{{ reportFormat }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.output') }}</dt>
              <dd>{{ lastExport || $t('status.noComparisonYet') }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
  </WorkbenchShell>
</template>

<style scoped>
.reports-script-view {
  display: grid;
  grid-template-rows: minmax(0, 1fr) 160px;
  gap: 8px;
  height: 100%;
  min-height: 0;
  padding: 8px;
  overflow: hidden;
}

.report-panel,
.script-panel {
  display: grid;
  grid-template-rows: 28px auto minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  background: var(--app-canvas);
}

.report-export-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 8px;
}

.report-export-form label {
  display: grid;
  gap: 4px;
}

.report-export-form span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.report-export-form input,
.report-export-form select {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
}

.report-error,
.report-empty {
  padding: 8px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.report-table {
  overflow: auto;
}

.report-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.4fr) 110px 110px minmax(180px, 1fr);
  min-height: 30px;
  border-bottom: 1px solid var(--app-border);
  font-size: 12px;
}

.report-row > * {
  min-width: 0;
  margin: 0;
  padding: 6px 8px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-row > *:last-child {
  border-right: 0;
}

.report-head {
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-weight: 700;
}

.script-panel pre {
  min-height: 0;
  margin: 0;
  padding: 10px;
  overflow: auto;
  background: var(--app-bg);
  color: var(--app-text);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 20px;
}
</style>
