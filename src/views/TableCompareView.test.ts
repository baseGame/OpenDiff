import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TableCompareView from './TableCompareView.vue'
import { compareTable, readTextFile } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import type { TableCompareRequest } from '@/types/diff'

vi.mock('@/api/diff', () => ({
  compareTable: vi.fn().mockResolvedValue({
    leftColumns: [
      { side: 'left', name: 'SKU' },
      { side: 'left', name: 'Quantity' },
    ],
    rightColumns: [
      { side: 'right', name: 'sku' },
      { side: 'right', name: 'Quantity' },
    ],
    columnMappings: [
      { leftColumn: 'SKU', rightColumn: 'sku', source: 'Automatic' },
      { leftColumn: 'Quantity', rightColumn: 'Quantity', source: 'Automatic' },
    ],
    rows: [
      {
        index: 0,
        leftCells: ['A-1', '12'],
        rightCells: ['A-1', '14'],
        status: 'Modified',
      },
    ],
    changedCells: [
      {
        rowIndex: 0,
        columnIndex: 1,
        leftValue: '12',
        rightValue: '14',
        status: 'Modified',
      },
    ],
    summary: {
      rowCount: 1,
      changedRowCount: 1,
      changedCellCount: 1,
    },
  }),
  readTextFile: vi.fn().mockImplementation((path: string) =>
    Promise.resolve({
      path,
      text: path.includes('left') ? 'SKU,Quantity\nA-1,12' : 'sku,Quantity\nA-1,14',
      encoding: 'UTF-8',
      lineEnding: 'LF',
      fileStamp: { size: 20, modifiedAtMs: 1 },
    }),
  ),
}))

function mountTableCompareView(): VueWrapper {
  return mount(TableCompareView, {
    global: {
      stubs: {
        NButton: {
          props: ['disabled', 'loading'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
      },
    },
  })
}

describe('TableCompareView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(compareTable).mockClear()
    vi.mocked(readTextFile).mockClear()
  })

  it('starts empty without a demo grid or sample CSV', () => {
    const wrapper = mountTableCompareView()

    expect(wrapper.text()).not.toContain('R1C1')
    expect(wrapper.findAll('[data-testid="table-grid-row"]')).toHaveLength(0)
    expect(
      (wrapper.find('[data-testid="table-left-path"]').element as HTMLInputElement).value,
    ).toBe('')
  })

  it('runs a table comparison with format, keys, and mappings', async () => {
    const wrapper = mountTableCompareView()

    await wrapper.find('[data-testid="table-left-path"]').setValue('C:/data/left.tsv')
    await wrapper.find('[data-testid="table-right-path"]').setValue('C:/data/right.tsv')
    await wrapper.find('[data-testid="table-format"]').setValue('tsv')
    await wrapper.find('[data-testid="table-key-columns"]').setValue('0')
    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    const lastCall = vi.mocked(compareTable).mock.lastCall

    expect(lastCall).toBeDefined()
    const [request] = lastCall as [TableCompareRequest]

    expect(request.format).toBe('tsv')
    expect(request.leftPath).toBe('C:/data/left.tsv')
    expect(request.rightPath).toBe('C:/data/right.tsv')
    expect(request.keyColumnIndices).toEqual([0])
    expect(wrapper.find('[data-testid="table-grid-cell-quantity"]').text()).toContain('12')
    expect(wrapper.find('[data-testid="active-table-cell"]').text()).toContain('12 -> 14')
  })

  it('reads dropped CSV launch paths and runs the table comparison', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'launch-table',
      source: 'drop',
      sessionType: 'table-compare',
      title: 'left.csv vs right.csv',
      route: '/compare/table',
      autoRun: true,
      locations: {
        left: { uri: 'C:/drop/left.csv', kind: 'file', readOnly: false },
        right: { uri: 'C:/drop/right.csv', kind: 'file', readOnly: false },
      },
    })

    mountTableCompareView()
    await Promise.resolve()
    await Promise.resolve()

    expect(readTextFile).toHaveBeenCalledWith('C:/drop/left.csv')
    expect(readTextFile).toHaveBeenCalledWith('C:/drop/right.csv')
    expect(compareTable).toHaveBeenCalledWith(
      expect.objectContaining({
        left: 'SKU,Quantity\nA-1,12',
        right: 'sku,Quantity\nA-1,14',
        format: 'csv',
        leftPath: 'C:/drop/left.csv',
        rightPath: 'C:/drop/right.csv',
      }),
    )
  })

  it('passes ignored columns and manual mappings to the backend', async () => {
    const wrapper = mountTableCompareView()

    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="manual-left-column"]').setValue('SKU')
    await wrapper.find('[data-testid="manual-right-column"]').setValue('sku')
    await wrapper.find('[data-testid="add-column-mapping"]').trigger('click')
    await wrapper.find('[data-testid="ignore-column-quantity"]').setValue(true)
    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    const request = vi.mocked(compareTable).mock.calls.at(-1)?.[0]

    if (!request) {
      throw new Error('compareTable was not called')
    }

    expect(request.ignoredColumns).toContain('Quantity')
    expect(request.manualMappings).toEqual([{ leftColumn: 'SKU', rightColumn: 'sku' }])
    expect(wrapper.find('[data-testid="column-mapping-list"]').text()).toContain('SKU -> sku')
  })

  it('keeps left and right table grid scroll positions synchronized', async () => {
    const wrapper = mount(TableCompareView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled', 'loading'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    const leftViewport = wrapper.find<HTMLElement>('[data-testid="left-table-grid-viewport"]')
    const rightViewport = wrapper.find<HTMLElement>('[data-testid="right-table-grid-viewport"]')

    leftViewport.element.scrollTop = 96
    leftViewport.element.scrollLeft = 44
    await leftViewport.trigger('scroll')

    expect(rightViewport.element.scrollTop).toBe(96)
    expect(rightViewport.element.scrollLeft).toBe(44)

    wrapper.unmount()
  })

  it('searches compared table cells and navigates to the next difference', async () => {
    const wrapper = mountTableCompareView()

    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="table-search-input"]').setValue('A-1')

    expect(wrapper.find('[data-testid="table-search-summary"]').text()).toContain('1 match')
    expect(wrapper.find('[data-testid="active-table-cell"]').text()).toContain('A-1')

    await wrapper.find('[data-testid="next-table-difference"]').trigger('click')

    expect(wrapper.find('[data-testid="active-table-cell"]').text()).toContain('12 -> 14')
  })
})
