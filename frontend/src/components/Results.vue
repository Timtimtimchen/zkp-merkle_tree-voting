<template>
  <div class="results-card fade-in">
    <div class="header-section">
      <h2>即時開票中心</h2>
      <p>所有票數皆從區塊鏈智能合約直接讀取，完全公開透明且無法篡改。</p>
    </div>

    <div class="refresh-controls">
      <button class="btn-refresh" @click="fetchResults" :disabled="loading">
        <span :class="['refresh-icon', { spinning: loading }]">↻</span>
        {{ loading ? '同步區塊鏈資料中...' : '更新最新票數' }}
      </button>
    </div>

    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <!-- 盲投隱藏畫面 -->
    <div v-else-if="hideResults" class="closed-state fade-in">
      <div class="closed-icon">🙈</div>
      <h3>盲投模式啟動中</h3>
      <p>為確保選舉公平性，目前暫不公開得票數。請等待管理員於選舉結束後揭曉！</p>
    </div>

    <!-- 正常開票畫面 -->
    <div v-else-if="results && results.length > 0" class="results-container">
      <div class="total-votes">
        總投票數：<span>{{ totalVotes }}</span> 票
      </div>

      <div class="bars-container">
        <div v-for="candidate in sortedResults" :key="candidate.id" class="result-row">
          <div class="candidate-info">
            <span class="c-name">{{ candidate.name }}</span>
            <span class="c-votes">{{ candidate.votes }} 票 ({{ getPercentage(candidate.votes) }}%)</span>
          </div>
          <div class="progress-bg">
            <div 
              class="progress-bar" 
              :style="{ width: getPercentage(candidate.votes) + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else-if="!loading" class="empty-state">
      尚無候選人資料。
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { API_URL } from '../config'

const results = ref([])
const loading = ref(false)
const error = ref('')
const hideResults = ref(true) // 預設隱藏，直到取得設定

// 計算總票數
const totalVotes = computed(() => {
  return results.value.reduce((sum, c) => sum + c.votes, 0)
})

// 根據得票數由高到低排序
const sortedResults = computed(() => {
  return [...results.value].sort((a, b) => b.votes - a.votes)
})

function getPercentage(votes) {
  if (totalVotes.value === 0) return 0;
  return ((votes / totalVotes.value) * 100).toFixed(1);
}

async function fetchResults() {
  loading.value = true
  error.value = ''
  
  try {
    // 1. 取得設定看是否隱藏票數
    const setRes = await fetch(`${API_URL}/settings`, { headers: { 'ngrok-skip-browser-warning': 'true' }})
    const setData = await setRes.json()
    if (setRes.ok && setData.success) {
      hideResults.value = setData.data.hide_results
    }

    // 2. 如果不隱藏，才去要資料（或者直接要資料，反正後端也會把票數變成 0）
    // 實務上可以直接呼叫，後端攔截會傳 0 回來，但這裡我們根據 hideResults 決定 UI
    const res = await fetch(`${API_URL}/results`, { headers: { 'ngrok-skip-browser-warning': 'true' }})
    const data = await res.json()
    
    if (res.ok && data.success) {
      results.value = data.data
    } else {
      error.value = data.error || '無法取得結果'
    }
  } catch (err) {
    console.error(err)
    error.value = '無法連線到伺服器'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchResults()
})
</script>

<style scoped>
.results-card {
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

.refresh-controls {
  display: flex;
  justify-content: flex-end;
}

.btn-refresh {
  background: white;
  border: 1px solid #cbd5e1;
  color: var(--text-primary);
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.btn-refresh:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #94a3b8;
  transform: translateY(-1px);
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-icon {
  font-size: 1.2rem;
  line-height: 1;
}

.spinning {
  animation: spin 1s linear infinite;
}

.results-container {
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
  backdrop-filter: blur(10px);
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

.total-votes {
  text-align: center;
  font-size: 1.2rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
  font-weight: 500;
}

.total-votes span {
  font-size: 2rem;
  font-weight: 800;
  color: var(--brand-color);
}

.bars-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.result-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.candidate-info {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.c-name {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--text-primary);
  flex-grow: 1;
}

.c-votes {
  font-weight: 700;
  color: var(--text-secondary);
}

.progress-bg {
  width: 100%;
  height: 16px;
  background-color: #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #6366f1 0%, #a855f7 100%);
  border-radius: 8px;
  transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
  overflow: hidden;
}

.progress-bar::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    rgba(255,255,255, 0) 0%,
    rgba(255,255,255, 0.2) 50%,
    rgba(255,255,255, 0) 100%
  );
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
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
.alert-error { background: rgba(239, 68, 68, 0.1); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.2); }
</style>
