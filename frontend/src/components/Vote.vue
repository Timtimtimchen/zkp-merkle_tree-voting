<template>
  <div class="vote-card fade-in">
    <div class="header-section">
      <h2>零知識匿名投票</h2>
      <p>您的選票將在手機端進行零知識加密，伺服器永遠不會知道您投給了誰。</p>
    </div>

    <!-- 選舉關閉時顯示 -->
    <div v-if="!isVotingOpen" class="closed-state fade-in">
      <div class="closed-icon">🔒</div>
      <h3>目前非投票期間</h3>
      <p>管理員已關閉票箱，請等待下次選舉開放。</p>
    </div>

    <!-- 選舉開放時顯示 -->
    <div v-else class="voting-container fade-in">
      <div class="credentials-group">
      <div class="input-group-modern">
        <label>您的 Nullifier (防止重複投票)</label>
        <input v-model="nullifier" type="password" placeholder="請輸入 Nullifier..." />
      </div>
      <div class="input-group-modern">
        <label>您的 Secret (最高機密)</label>
        <input v-model="secret" type="password" placeholder="請輸入 Secret..." />
      </div>
    </div>
    
    <div class="candidates-section">
      <h3>請選擇支持的候選人</h3>
      
      <div v-if="fetchingCandidates" class="loading-state">
        <div class="spinner"></div> 載入候選人名單中...
      </div>
      
      <div v-else-if="candidates.length === 0" class="empty-state">
        目前沒有候選人，請聯繫管理員。
      </div>

      <div v-else class="candidate-grid">
        <div 
          v-for="c in candidates" 
          :key="c.id" 
          :class="['candidate-option', { selected: candidate === c.id.toString() }]"
          @click="candidate = c.id.toString()"
        >
          <div class="check-circle">
            <svg v-if="candidate === c.id.toString()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div class="c-name">{{ c.name }}</div>
        </div>
      </div>
    </div>

    <button class="btn-primary vote-btn" @click="handleVote" :disabled="loading || !candidate">
      <span v-if="loading" class="spinner-small"></span>
      {{ loading ? '產生證明並上鏈中...' : '確認送出選票' }}
    </button>

    <transition name="slide-fade">
      <div v-if="message" :class="['alert', messageType]">
        {{ message }}
      </div>
    </transition>
    
    </div> <!-- 結束 voting-container -->
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { generateProof, calculateNullifierHash, generateMerkleProof, calculateCommitment } from '../utils/zk'
import { API_URL } from '../config'

const nullifier = ref('')
const secret = ref('')
const candidate = ref('')
const candidates = ref([])
const fetchingCandidates = ref(true)
const loading = ref(false)
const message = ref('')
const messageType = ref('')
const isVotingOpen = ref(true) // 預設開放，直到拉取設定

async function fetchSettingsAndCandidates() {
  fetchingCandidates.value = true
  try {
    const setRes = await fetch(`${API_URL}/settings`, { headers: { 'ngrok-skip-browser-warning': 'true' }})
    const setData = await setRes.json()
    if (setRes.ok && setData.success) {
      isVotingOpen.value = setData.data.is_voting_open
    }

    if (isVotingOpen.value) {
      const res = await fetch(`${API_URL}/candidates`, { headers: { 'ngrok-skip-browser-warning': 'true' }})
      const data = await res.json()
      if (res.ok && data.success) {
        candidates.value = data.data
      }
    }
  } catch (err) {
    console.error("Failed to load data", err)
  } finally {
    fetchingCandidates.value = false
  }
}

onMounted(() => {
  fetchSettingsAndCandidates()
})

async function handleVote() {
  if (!nullifier.value || !secret.value) {
    showMessage('請填寫完整的憑證', 'alert-error')
    return
  }
  if (!candidate.value) {
    showMessage('請選擇一位候選人', 'alert-error')
    return
  }

  loading.value = true
  showMessage('正在本地計算零知識證明...', 'alert-info')

  try {
    const commitments = JSON.parse(localStorage.getItem('merkleTree') || "[]")
    const leaf = await calculateCommitment(nullifier.value.trim(), secret.value.trim())
    const { root, pathElements, pathIndices } = await generateMerkleProof(commitments, leaf)

    const { proof, publicSignals } = await generateProof(
      nullifier.value.trim(),
      secret.value.trim(),
      candidate.value,
      root,
      pathElements,
      pathIndices
    )

    showMessage('證明產生完成，正在由 Relayer 發送交易...', 'alert-info')
    
    const res = await fetch(`${API_URL}/vote`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({
        a: proof.pi_a.slice(0, 2),
        b: [
          proof.pi_b[0].slice(0, 2).reverse(),
          proof.pi_b[1].slice(0, 2).reverse()
        ],
        c: proof.pi_c.slice(0, 2),
        root: publicSignals[0],
        nullifierHash: publicSignals[1],
        candidate: publicSignals[2]
      })
    })

    const data = await res.json()
    if (res.ok && data.success) {
      showMessage('✅ 投票成功！交易已上鏈。', 'alert-success')
      nullifier.value = ''
      secret.value = ''
      candidate.value = ''
    } else {
      showMessage(data.error || '投票失敗', 'alert-error')
    }
  } catch (err) {
    console.error(err)
    showMessage('發生錯誤，請檢查憑證或網路連線。', 'alert-error')
  } finally {
    loading.value = false
  }
}

function showMessage(msg, type) {
  message.value = msg
  messageType.value = type
}
</script>

<style scoped>
.vote-card {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.header-section h2 {
  margin: 0;
  font-size: 1.8rem;
  color: var(--text-primary);
  font-weight: 700;
  letter-spacing: -0.5px;
}

.header-section p {
  margin: 0.5rem 0 0 0;
  color: var(--text-secondary);
}

.voting-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.closed-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  text-align: center;
}

.closed-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.closed-state h3 {
  font-size: 1.5rem;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.closed-state p {
  color: var(--text-secondary);
}

.credentials-group {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  background: rgba(255, 255, 255, 0.4);
  padding: 1.5rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.6);
}

.input-group-modern {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-group-modern label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95rem;
}

.input-group-modern input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
  transition: all 0.2s;
  box-sizing: border-box;
}

.input-group-modern input:focus {
  outline: none;
  border-color: var(--brand-color);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.candidates-section h3 {
  font-size: 1.2rem;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.candidate-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.candidate-option {
  position: relative;
  background: rgba(255, 255, 255, 0.6);
  border: 2px solid transparent;
  border-radius: 16px;
  padding: 1.5rem 1rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
}

.candidate-option:hover {
  transform: translateY(-4px);
  background: white;
  box-shadow: 0 10px 20px rgba(99, 102, 241, 0.1);
}

.candidate-option.selected {
  border-color: var(--brand-color);
  background: white;
  box-shadow: 0 10px 25px rgba(99, 102, 241, 0.15);
}

.check-circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #cbd5e1;
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.candidate-option.selected .check-circle {
  background: var(--brand-color);
  border-color: var(--brand-color);
  color: white;
}

.c-name {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
}

.vote-btn {
  margin-top: 1rem;
  padding: 1rem;
  font-size: 1.1rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
}

.btn-primary:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--text-secondary);
  gap: 0.8rem;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(99, 102, 241, 0.2);
  border-top-color: var(--brand-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.alert {
  padding: 1rem;
  border-radius: 10px;
  font-weight: 500;
  text-align: center;
}
.alert-success { background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16, 185, 129, 0.2); }
.alert-error { background: rgba(239, 68, 68, 0.1); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.2); }
.alert-info { background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.2); }

.slide-fade-enter-active { transition: all 0.3s ease-out; }
.slide-fade-leave-active { transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1); }
.slide-fade-enter-from, .slide-fade-leave-to { transform: translateY(-10px); opacity: 0; }
</style>
