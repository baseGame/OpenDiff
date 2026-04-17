<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { FolderTree, Plus, Trash2, Edit, Save, X, HardDrive, Cloud, Server, Globe } from 'lucide-vue-next'

interface VfsConnection {
  id: string
  name: string
  type: 'local' | 's3' | 'sftp' | 'ftp' | 'webdav'
  url?: string
  host?: string
  port?: number
  username?: string
  password?: string
  bucket?: string
  region?: string
  path?: string
}

const connections = ref<VfsConnection[]>([])
const showForm = ref(false)
const editingId = ref<string | null>(null)
const testResult = ref<{ success: boolean; message: string } | null>(null)

const form = ref<VfsConnection>({
  id: '',
  name: '',
  type: 'sftp',
  host: '',
  port: 22,
  username: '',
  password: '',
  path: '/',
})

const connectionTypes = [
  { value: 'local', label: '本地文件系统', icon: HardDrive },
  { value: 's3', label: 'Amazon S3', icon: Cloud },
  { value: 'sftp', label: 'SFTP', icon: Server },
  { value: 'ftp', label: 'FTP', icon: Globe },
  { value: 'webdav', label: 'WebDAV', icon: Globe },
]

onMounted(async () => {
  await loadConnections()
})

async function loadConnections() {
  try {
    const stored = localStorage.getItem('opendiff_vfs_connections')
    if (stored) {
      connections.value = JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load VFS connections:', e)
  }
}

function saveConnections() {
  localStorage.setItem('opendiff_vfs_connections', JSON.stringify(connections.value))
}

function openNewForm() {
  editingId.value = null
  form.value = {
    id: '',
    name: '',
    type: 'sftp',
    host: '',
    port: 22,
    username: '',
    password: '',
    path: '/',
  }
  testResult.value = null
  showForm.value = true
}

function openEditForm(conn: VfsConnection) {
  editingId.value = conn.id
  form.value = { ...conn }
  testResult.value = null
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editingId.value = null
}

function addConnection() {
  if (!form.value.name) return
  
  const newConn: VfsConnection = {
    ...form.value,
    id: editingId.value || `vfs_${Date.now()}`
  }
  
  if (editingId.value) {
    const idx = connections.value.findIndex(c => c.id === editingId.value)
    if (idx !== -1) {
      connections.value[idx] = newConn
    }
  } else {
    connections.value.push(newConn)
  }
  
  saveConnections()
  closeForm()
}

function deleteConnection(id: string) {
  if (!confirm('确定要删除此连接吗？')) return
  connections.value = connections.value.filter(c => c.id !== id)
  saveConnections()
}

async function testConnection() {
  testResult.value = null
  try {
    const url = buildConnectionUrl(form.value)
    // TODO: Call Tauri command to test connection
    // const result = await invoke('test_vfs_connection', { url })
    testResult.value = {
      success: true,
      message: `连接测试成功：${url}`
    }
  } catch (e: any) {
    testResult.value = {
      success: false,
      message: `连接失败：${e.message || e}`
    }
  }
}

function buildConnectionUrl(conn: VfsConnection): string {
  switch (conn.type) {
    case 'local':
      return conn.path || '/'
    case 's3':
      return `s3://${conn.bucket || ''}${conn.region ? `?region=${conn.region}` : ''}`
    case 'sftp':
      return `sftp://${conn.username || ''}:${conn.password ? '***' : ''}@${conn.host || ''}:${conn.port || 22}${conn.path || '/'}`
    case 'ftp':
      return `ftp://${conn.username || ''}:${conn.password ? '***' : ''}@${conn.host || ''}:${conn.port || 21}${conn.path || '/'}`
    case 'webdav':
      return `webdav://${conn.host || ''}:${conn.port || 443}${conn.path || '/'}`
    default:
      return ''
  }
}

async function selectLocalPath() {
  const path = await open({ directory: true, multiple: false })
  if (path) {
    form.value.path = path as string
  }
}

async function connectToVfs(conn: VfsConnection) {
  // Emit event or navigate to folder diff with VFS path
  const url = buildConnectionUrl(conn)
  console.log('Connecting to VFS:', url)
  // TODO: Navigate to folder diff view with VFS URL
}
</script>

<template>
  <div class="vfs-connections-view">
    <div class="header">
      <h2>
        <FolderTree class="icon" />
        远程连接管理器
      </h2>
      <button class="btn btn-primary" @click="openNewForm">
        <Plus :size="18" />
        新建连接
      </button>
    </div>

    <div class="connections-grid">
      <div 
        v-for="conn in connections" 
        :key="conn.id" 
        class="connection-card"
        @dblclick="connectToVfs(conn)"
      >
        <div class="card-header">
          <component :is="connectionTypes.find(t => t.value === conn.type)?.icon || Globe" class="type-icon" />
          <h3>{{ conn.name }}</h3>
        </div>
        
        <div class="card-body">
          <div class="info-row">
            <span class="label">类型:</span>
            <span class="value">{{ connectionTypes.find(t => t.value === conn.type)?.label || conn.type }}</span>
          </div>
          <div v-if="conn.host" class="info-row">
            <span class="label">主机:</span>
            <span class="value">{{ conn.host }}:{{ conn.port }}</span>
          </div>
          <div v-if="conn.username" class="info-row">
            <span class="label">用户:</span>
            <span class="value">{{ conn.username }}</span>
          </div>
          <div v-if="conn.path" class="info-row">
            <span class="label">路径:</span>
            <span class="value">{{ conn.path }}</span>
          </div>
        </div>
        
        <div class="card-actions">
          <button class="btn btn-sm" @click.stop="connectToVfs(conn)" title="连接">
            <Globe :size="16" />
          </button>
          <button class="btn btn-sm" @click.stop="openEditForm(conn)" title="编辑">
            <Edit :size="16" />
          </button>
          <button class="btn btn-sm btn-danger" @click.stop="deleteConnection(conn.id)" title="删除">
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
      
      <div v-if="connections.length === 0" class="empty-state">
        <FolderTree :size="48" class="empty-icon" />
        <p>暂无远程连接</p>
        <button class="btn btn-primary" @click="openNewForm">
          <Plus :size="18" />
          创建第一个连接
        </button>
      </div>
    </div>

    <!-- Connection Form Modal -->
    <Teleport to="body">
      <div v-if="showForm" class="modal-backdrop" @click.self="closeForm">
        <div class="modal-panel">
          <div class="modal-header">
            <h3>{{ editingId ? '编辑连接' : '新建连接' }}</h3>
            <button class="close-btn" @click="closeForm">
              <X :size="20" />
            </button>
          </div>
          
          <div class="modal-body">
            <div class="form-group">
              <label>连接名称</label>
              <input v-model="form.name" type="text" placeholder="例如：生产服务器" />
            </div>
            
            <div class="form-group">
              <label>连接类型</label>
              <select v-model="form.type">
                <option v-for="t in connectionTypes" :key="t.value" :value="t.value">
                  {{ t.label }}
                </option>
              </select>
            </div>
            
            <!-- Local FS fields -->
            <div v-if="form.type === 'local'" class="form-group">
              <label>本地路径</label>
              <div class="input-with-button">
                <input v-model="form.path" type="text" placeholder="/path/to/folder" />
                <button class="btn" @click="selectLocalPath">浏览...</button>
              </div>
            </div>
            
            <!-- S3 fields -->
            <div v-if="form.type === 's3'">
              <div class="form-group">
                <label>Bucket 名称</label>
                <input v-model="form.bucket" type="text" placeholder="my-bucket" />
              </div>
              <div class="form-group">
                <label>区域 (Region)</label>
                <input v-model="form.region" type="text" placeholder="us-east-1" />
              </div>
            </div>
            
            <!-- SFTP/FTP/WebDAV fields -->
            <div v-if="['sftp', 'ftp', 'webdav'].includes(form.type)">
              <div class="form-group">
                <label>主机地址</label>
                <input v-model="form.host" type="text" placeholder="example.com" />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>端口</label>
                  <input v-model.number="form.port" type="number" :placeholder="form.type === 'sftp' ? '22' : form.type === 'ftp' ? '21' : '443'" />
                </div>
                <div class="form-group">
                  <label>用户名</label>
                  <input v-model="form.username" type="text" placeholder="username" />
                </div>
              </div>
              <div class="form-group">
                <label>密码</label>
                <input v-model="form.password" type="password" placeholder="••••••••" />
              </div>
              <div class="form-group">
                <label>远程路径</label>
                <input v-model="form.path" type="text" placeholder="/" />
              </div>
            </div>
            
            <!-- Test Result -->
            <div v-if="testResult" :class="['test-result', testResult.success ? 'success' : 'error']">
              {{ testResult.message }}
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="btn" @click="testConnection">测试连接</button>
            <div class="spacer"></div>
            <button class="btn" @click="closeForm">取消</button>
            <button class="btn btn-primary" @click="addConnection">
              <Save :size="16" />
              {{ editingId ? '保存' : '创建' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.vfs-connections-view {
  padding: 24px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.header h2 {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  font-size: 20px;
}

.icon {
  color: var(--color-primary);
}

.connections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.connection-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.connection-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.type-icon {
  color: var(--color-primary);
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.card-body {
  margin-bottom: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 6px;
}

.label {
  color: var(--color-text-muted);
}

.value {
  color: var(--color-text);
  font-family: monospace;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover {
  border-color: var(--color-primary);
}

.btn-primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-sm {
  padding: 6px 10px;
}

.btn-danger {
  color: #ef4444;
  border-color: #ef4444;
}

.btn-danger:hover {
  background: #ef4444;
  color: white;
}

.empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  text-align: center;
  color: var(--color-text-muted);
}

.empty-icon {
  margin-bottom: 16px;
  opacity: 0.5;
}

/* Modal styles */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--color-border);
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 14px;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 12px;
}

.input-with-button {
  display: flex;
  gap: 8px;
}

.input-with-button input {
  flex: 1;
}

.test-result {
  padding: 12px;
  border-radius: 6px;
  margin-top: 16px;
  font-size: 14px;
}

.test-result.success {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid #22c55e;
}

.test-result.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid #ef4444;
}

.modal-footer {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
  gap: 12px;
}

.spacer {
  flex: 1;
}
</style>
