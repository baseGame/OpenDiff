/**
 * useDragDrop — generic drag-and-drop file handler
 * Works in: browser (File System Access API), Tauri (via window.__TAURI__)
 */
import { ref } from 'vue'

export interface DroppedFile {
  name: string
  content: string   // text content (UTF-8)
  path?: string     // full path (Tauri only)
}

export function useDragDrop(onDrop: (files: DroppedFile[]) => void) {
  const isDragging = ref(false)
  let dragCounter = 0

  function onDragEnter(e: DragEvent) {
    e.preventDefault()
    dragCounter++
    isDragging.value = true
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault()
    dragCounter--
    if (dragCounter === 0) isDragging.value = false
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  async function onDropEvent(e: DragEvent) {
    e.preventDefault()
    isDragging.value = false
    dragCounter = 0
    const files: DroppedFile[] = []
    const items = e.dataTransfer?.files
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const file = items[i]
      try {
        // Try File System Access API (Chrome/Edge)
        const text = await file.text()
        files.push({
          name: file.name,
          content: text,
          path: (file as any).path ?? file.name,
        })
      } catch {
        // fallback: read as base64 then decode
        try {
          const buf = await file.arrayBuffer()
          const decoder = new TextDecoder('utf-8', { fatal: false })
          files.push({ name: file.name, content: decoder.decode(buf) })
        } catch {
          // skip unreadable files
        }
      }
    }
    if (files.length) onDrop(files)
  }

  const dragDropHandlers = {
    'dragenter': onDragEnter,
    'dragleave': onDragLeave,
    'dragover': onDragOver,
    'drop': onDropEvent,
  }

  function attachDropZone(el: HTMLElement | null) {
    if (!el) return
    for (const [event, handler] of Object.entries(dragDropHandlers)) {
      el.addEventListener(event, handler as EventListener)
    }
  }

  function detachDropZone(el: HTMLElement | null) {
    if (!el) return
    for (const [event, handler] of Object.entries(dragDropHandlers)) {
      el.removeEventListener(event, handler as EventListener)
    }
  }

  return { isDragging, attachDropZone, detachDropZone }
}
