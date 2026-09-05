import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAppRuntimeInfo, loadAdminPolicy, type PolicyFlags } from '@/api/policy'

export const usePolicyStore = defineStore('policy', () => {
  const savePasswords = ref(true)
  const remoteProfiles = ref(true)
  const updateChecks = ref(true)
  const loaded = ref(false)
  const os = ref('')
  const family = ref('')
  const isWindows = computed(() => os.value === 'windows' || family.value === 'windows')
  const isMac = computed(() => os.value === 'macos' || os.value === 'darwin')
  const isLinux = computed(() => os.value === 'linux')
  const supportsUnixShell = computed(() => isMac.value || isLinux.value)

  function apply(flags: PolicyFlags): void {
    savePasswords.value = flags.savePasswords
    remoteProfiles.value = flags.remoteProfiles
    updateChecks.value = flags.updateChecks
    loaded.value = true
  }

  async function load(): Promise<void> {
    try {
      apply(await loadAdminPolicy())
    } catch {
      loaded.value = true
    }

    try {
      const runtime = await getAppRuntimeInfo()

      os.value = runtime.os
      family.value = runtime.family
    } catch {
      // Unit tests and missing Tauri backends keep the default desktop flags.
    }
  }

  return {
    savePasswords,
    remoteProfiles,
    updateChecks,
    loaded,
    os,
    family,
    isWindows,
    isMac,
    isLinux,
    supportsUnixShell,
    apply,
    load,
  }
})
