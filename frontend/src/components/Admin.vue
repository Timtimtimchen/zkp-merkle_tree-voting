<template>
  <div class="admin-panel fade-in">
    <div class="header-section">
      <h2>後台管理中心</h2>
      <p>在此設定開放給選民投票的候選人名單與系統狀態</p>
    </div>

    <!-- 登入畫面 -->
    <div v-if="!isLoggedIn" class="login-container">
      <div class="login-box">
        <h3>管理員登入</h3>
        <p>請輸入密碼以進入後台管理</p>
        <div class="input-group-modern">
          <input 
            v-model="passwordInput" 
            type="password" 
            placeholder="請輸入密碼..."
            @keyup.enter="handleLogin"
          />
          <button class="btn-primary" @click="handleLogin">
            登入
          </button>
        </div>
        <div v-if="loginError" class="alert alert-error mt-2">
          密碼錯誤，請重試
        </div>
      </div>
    </div>

    <!-- 管理畫面 -->
    <div v-else class="admin-dashboard fade-in">
      
      <!-- 區塊 1: 系統設定 -->
      <div class="admin-section">
        <h3>⚙️ 系統全域設定</h3>
        <div class="settings-grid">
          <div class="setting-card">
            <div class="setting-info">
              <h4>選舉狀態</h4>
              <p>{{ settings.is_voting_open ? '目前開放投票中' : '目前已關閉投票' }}</p>
            </div>
            <button 
              :class="['btn-toggle', settings.is_voting_open ? 'btn-danger' : 'btn-success']"
              @click="toggleSetting('is_voting_open', !settings.is_voting_open)"
            >
              {{ settings.is_voting_open ? '停止投票' : '開始投票' }}
            </button>
          </div>
          <div class="setting-card">
            <div class="setting-info">
              <h4>即時開票狀態 (盲投)</h4>
              <p>{{ settings.hide_results ? '目前隱藏票數' : '目前公開票數' }}</p>
            </div>
            <button 
              :class="['btn-toggle', settings.hide_results ? 'btn-warning' : 'btn-success']"
              @click="toggleSetting('hide_results', !settings.hide_results)"
            >
              {{ settings.hide_results ? '公開票數' : '隱藏票數' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 區塊 2: 選民名冊管理 -->
      <div class="admin-section">
        <h3>👥 選民白名單管理 ({{ students.length }} 人)</h3>
        <div class="split-layout">
          <div class="list-container">
            <div v-if="loadingStudents" class="loading-state">載入中...</div>
            <div v-else-if="students.length === 0" class="empty-state">尚無選民資料</div>
            <ul v-else class="student-list">
              <li v-for="s in students" :key="s.uid">
                <span>{{ s.uid }}</span>
                <span class="status-badge" :class="s.has_voted ? 'voted' : 'pending'">
                  {{ s.has_voted ? '已投票' : '未投票' }}
                </span>
                <button class="btn-icon" @click="deleteStudent(s.uid)" title="刪除選民">×</button>
              </li>
            </ul>
          </div>
          <div class="action-container">
            <h4>新增選民 (學號)</h4>
            <div class="input-group-modern">
              <input 
                v-model="newStudentUid" 
                type="text" 
                placeholder="例如: E2345678"
                @keyup.enter="addStudent"
              />
              <button class="btn-primary" @click="addStudent" :disabled="!newStudentUid.trim()">
                新增至白名單
              </button>
            </div>
            <div v-if="studentMsg" :class="['alert mt-2', isStudentError ? 'alert-error' : 'alert-success']">
              {{ studentMsg }}
            </div>
          </div>
        </div>
      </div>

      <!-- 區塊 3: 候選人管理 -->
      <div class="admin-section">
        <h3>🏆 候選人管理 ({{ candidates.length }} 人)</h3>
        <div class="split-layout">
          <div class="list-container candidate-grid">
            <div v-if="loadingCandidates" class="loading-state" style="grid-column: 1/-1">載入中...</div>
            <div v-else-if="candidates.length === 0" class="empty-state" style="grid-column: 1/-1">尚無候選人</div>
            <div v-else v-for="c in candidates" :key="c.id" class="candidate-card">
              <button class="btn-delete" @click="deleteCandidate(c.id)" title="刪除候選人">×</button>
              <div class="candidate-name">{{ c.name }}</div>
            </div>
          </div>
          <div class="action-container">
            <h4>新增候選人</h4>
            <div class="input-group-modern">
              <input 
                v-model="newCandidateName" 
                type="text" 
                placeholder="請輸入候選人姓名..."
                @keyup.enter="addCandidate"
              />
              <button class="btn-primary" @click="addCandidate" :disabled="addingCandidate || !newCandidateName.trim()">
                {{ addingCandidate ? '新增中...' : '確認新增' }}
              </button>
            </div>
            <div v-if="candidateMsg" :class="['alert mt-2', isCandidateError ? 'alert-error' : 'alert-success']">
              {{ candidateMsg }}
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { API_URL } from '../config'

// 登入狀態
const isLoggedIn = ref(false)
const passwordInput = ref('')
const loginError = ref(false)
const ADMIN_PASSWORD = 'admin'

// 設定狀態
const settings = ref({ is_voting_open: false, hide_results: true })

// 候選人狀態
const candidates = ref([])
const newCandidateName = ref('')
const loadingCandidates = ref(true)
const addingCandidate = ref(false)
const candidateMsg = ref('')
const isCandidateError = ref(false)

// 選民狀態
const students = ref([])
const newStudentUid = ref('')
const loadingStudents = ref(true)
const studentMsg = ref('')
const isStudentError = ref(false)

function handleLogin() {
  if (passwordInput.value === ADMIN_PASSWORD) {
    isLoggedIn.value = true
    loginError.value = false
    fetchAllData()
  } else {
    loginError.value = true
    passwordInput.value = ''
  }
}

async function fetchAllData() {
  await fetchSettings()
  await fetchCandidates()
  await fetchStudents()
}

// ================= 系統設定 API =================
async function fetchSettings() {
  try {
    const res = await fetch(`${API_URL}/settings`, { headers: { 'ngrok-skip-browser-warning': 'true' }})
    const data = await res.json()
    if (res.ok && data.success) {
      settings.value = data.data
    }
  } catch (err) {
    console.error(err)
  }
}

async function toggleSetting(key, value) {
  try {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ [key]: value })
    })
    if (res.ok) {
      await fetchSettings()
    }
  } catch (err) {
    console.error(err)
  }
}

// ================= 選民白名單 API =================
async function fetchStudents() {
  loadingStudents.value = true
  try {
    const res = await fetch(`${API_URL}/students`, { headers: { 'ngrok-skip-browser-warning': 'true' }})
    const data = await res.json()
    if (res.ok && data.success) {
      students.value = data.data
    }
  } catch (err) {
    console.error(err)
  } finally {
    loadingStudents.value = false
  }
}

async function addStudent() {
  if (!newStudentUid.value.trim()) return
  try {
    const res = await fetch(`${API_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ uid: newStudentUid.value })
    })
    const data = await res.json()
    if (res.ok && data.success) {
      studentMsg.value = '新增成功！'
      isStudentError.value = false
      newStudentUid.value = ''
      await fetchStudents()
    } else {
      studentMsg.value = data.error || '新增失敗'
      isStudentError.value = true
    }
  } catch (err) {
    studentMsg.value = '連線錯誤'
    isStudentError.value = true
  } finally {
    setTimeout(() => { studentMsg.value = '' }, 3000)
  }
}

async function deleteStudent(uid) {
  if (!confirm(`確定要刪除選民 ${uid} 嗎？`)) return
  try {
    const res = await fetch(`${API_URL}/students/${uid}`, { method: 'DELETE', headers: { 'ngrok-skip-browser-warning': 'true' }})
    if (res.ok) await fetchStudents()
  } catch (err) {
    console.error(err)
  }
}

// ================= 候選人 API =================
async function fetchCandidates() {
  loadingCandidates.value = true
  try {
    const res = await fetch(`${API_URL}/candidates`, { headers: { 'ngrok-skip-browser-warning': 'true' }})
    const data = await res.json()
    if (res.ok && data.success) {
      candidates.value = data.data
    }
  } catch (err) {
    console.error(err)
  } finally {
    loadingCandidates.value = false
  }
}

async function addCandidate() {
  if (!newCandidateName.value.trim()) return
  addingCandidate.value = true
  try {
    const res = await fetch(`${API_URL}/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ name: newCandidateName.value })
    })
    const data = await res.json()
    if (res.ok && data.success) {
      candidateMsg.value = '新增成功！'
      isCandidateError.value = false
      newCandidateName.value = ''
      await fetchCandidates()
    } else {
      candidateMsg.value = data.error || '新增失敗'
      isCandidateError.value = true
    }
  } catch (err) {
    candidateMsg.value = '連線錯誤'
    isCandidateError.value = true
  } finally {
    addingCandidate.value = false
    setTimeout(() => { candidateMsg.value = '' }, 3000)
  }
}

async function deleteCandidate(id) {
  if (!confirm('確定要刪除這位候選人嗎？')) return;
  try {
    const res = await fetch(`${API_URL}/candidates/${id}`, { method: 'DELETE', headers: { 'ngrok-skip-browser-warning': 'true' }});
    if (res.ok) await fetchCandidates();
  } catch (err) {
    console.error(err);
  }
}
</script>

<style scoped>
.admin-panel { display: flex; flex-direction: column; gap: 2rem; }
.header-section h2 { margin: 0; font-size: 1.8rem; color: var(--text-primary); font-weight: 700; }
.header-section p { margin: 0.5rem 0 0 0; color: var(--text-secondary); }

/* Login */
.login-container { display: flex; justify-content: center; align-items: center; padding: 2rem 0; }
.login-box { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.8); border-radius: 16px; padding: 2rem; width: 100%; max-width: 400px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05); text-align: center; }
.login-box h3 { margin-top: 0; color: var(--brand-color); }
.login-box p { margin-bottom: 1.5rem; color: var(--text-secondary); font-size: 0.9rem; }
.mt-2 { margin-top: 1rem; }

/* Dashboard Sections */
.admin-dashboard { display: flex; flex-direction: column; gap: 2.5rem; }
.admin-section { background: rgba(255, 255, 255, 0.4); border: 1px solid rgba(255, 255, 255, 0.6); border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
.admin-section h3 { font-size: 1.3rem; font-weight: 700; color: var(--brand-color); margin-bottom: 1.5rem; border-bottom: 2px solid rgba(99, 102, 241, 0.1); padding-bottom: 0.8rem; }
.admin-section h4 { font-size: 1rem; color: var(--text-primary); margin-bottom: 0.8rem; }

/* System Settings */
.settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
.setting-card { display: flex; justify-content: space-between; align-items: center; background: white; padding: 1.2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
.setting-info h4 { margin: 0 0 0.3rem 0; font-size: 1.1rem; }
.setting-info p { margin: 0; font-size: 0.85rem; color: var(--text-secondary); }
.btn-toggle { padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; border: none; cursor: pointer; transition: 0.2s; color: white; }
.btn-success { background: #10b981; } .btn-success:hover { background: #059669; }
.btn-danger { background: #ef4444; } .btn-danger:hover { background: #dc2626; }
.btn-warning { background: #f59e0b; } .btn-warning:hover { background: #d97706; }

/* Split Layout (Lists + Actions) */
.split-layout { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }
@media (min-width: 768px) { .split-layout { grid-template-columns: 2fr 1fr; } }
.list-container { background: rgba(255, 255, 255, 0.5); border-radius: 12px; padding: 1rem; min-height: 150px; max-height: 300px; overflow-y: auto; }
.action-container { background: white; border-radius: 12px; padding: 1.2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.02); height: fit-content; }

/* Student List */
.student-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.student-list li { display: flex; align-items: center; justify-content: space-between; padding: 0.8rem 1rem; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
.status-badge { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 12px; font-weight: 600; }
.status-badge.voted { background: rgba(16,185,129,0.1); color: #059669; }
.status-badge.pending { background: rgba(245,158,11,0.1); color: #d97706; }
.btn-icon { background: none; border: none; color: #ef4444; font-size: 1.2rem; cursor: pointer; opacity: 0.6; padding: 0 0.5rem; }
.btn-icon:hover { opacity: 1; }

/* Candidate Grid */
.candidate-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 1rem; align-content: flex-start; }
.candidate-card { position: relative; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem 1rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.candidate-card:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.3); }
.candidate-name { font-weight: 600; color: var(--text-primary); }
.btn-delete { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; border-radius: 50%; background: rgba(239,68,68,0.1); color: #ef4444; border: none; font-size: 14px; cursor: pointer; opacity: 0; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
.candidate-card:hover .btn-delete { opacity: 1; }
.btn-delete:hover { background: #ef4444; color: white; }

/* Shared Inputs */
.input-group-modern { display: flex; flex-direction: column; gap: 0.8rem; }
.input-group-modern input { padding: 10px 14px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.95rem; }
.input-group-modern input:focus { outline: none; border-color: var(--brand-color); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
.btn-primary { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; border: none; border-radius: 8px; padding: 10px; font-weight: 600; cursor: pointer; transition: 0.2s; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(99,102,241,0.2); }

.alert { padding: 0.8rem; border-radius: 8px; font-size: 0.85rem; font-weight: 500; text-align: center; }
.alert-success { background: rgba(16,185,129,0.1); color: #059669; }
.alert-error { background: rgba(239,68,68,0.1); color: #dc2626; }
.empty-state { text-align: center; padding: 2rem; color: #94a3b8; font-style: italic; }
.loading-state { text-align: center; padding: 2rem; color: #64748b; }
</style>
