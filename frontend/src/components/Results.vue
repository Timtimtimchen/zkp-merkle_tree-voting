<template>
  <div class="results-card">
    <h2>🗳️ 即時開票結果 (階段三)</h2>
    <p>直接向智能合約查詢最新票數，無人能竄改！</p>
    
    <button @click="fetchResults" :disabled="loading" class="refresh-btn">
      <span v-if="loading">查詢中...</span>
      <span v-else>🔄 更新票數</span>
    </button>

    <div v-if="results" class="results-display">
      <div class="candidate">
        <div class="avatar">👩🏻‍trong>1號 Alice</div>
        <div class="bar-container">
          <div class="bar alice-bar" :style="{ width: getPercentage(results.candidate1) + '%' }"></div>
        </div>
        <div class="votes">{{ results.candidate1 }} 票</div>
      </div>
      
      <div class="candidate">
        <div class="avatar">🧑🏽‍trong>2號 Bob</div>
        <div class="bar-container">
          <div class="bar bob-bar" :style="{ width: getPercentage(results.candidate2) + '%' }"></div>
        </div>
        <div class="votes">{{ results.candidate2 }} 票</div>
      </div>
    </div>
    
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const results = ref(null)
const loading = ref(false)
const error = ref('')

async function fetchResults() {
  loading.value = true
  error.value = ''
  
  try {
    const res = await fetch('http://localhost:3000/results')
    const data = await res.json()
    
    if (res.ok && data.success) {
      results.value = data
    } else {
      error.value = data.error || '無法取得結果'
    }
  } catch (err) {
    error.value = '網路連線錯誤，請確認後端已啟動'
    console.error(err)
  } finally {
    loading.value = false
  }
}

function getPercentage(votes) {
  if (!results.value) return 0
  const total = results.value.candidate1 + results.value.candidate2
  if (total === 0) return 0
  return (votes / total) * 100
}
</script>

<style scoped>
.results-card {
  text-align: center;
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  margin-top: 30px;
}
.refresh-btn {
  background-color: #f39c12;
  color: white;
  border: none;
  padding: 10px 20px;
  font-size: 16px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 20px;
  transition: transform 0.2s;
}
.refresh-btn:hover {
  transform: scale(1.05);
}
.results-display {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.candidate {
  display: flex;
  align-items: center;
  gap: 15px;
  background: #f8f9fa;
  padding: 10px 20px;
  border-radius: 8px;
}
.avatar {
  font-size: 18px;
  width: 100px;
  text-align: left;
}
.bar-container {
  flex-grow: 1;
  background: #e9ecef;
  height: 20px;
  border-radius: 10px;
  overflow: hidden;
}
.bar {
  height: 100%;
  transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
}
.alice-bar { background-color: #3498db; }
.bob-bar { background-color: #e74c3c; }
.votes {
  font-weight: bold;
  font-size: 18px;
  width: 60px;
}
.error {
  color: #e74c3c;
  margin-top: 15px;
}
</style>
