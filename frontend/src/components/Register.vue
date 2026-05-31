<template>
  <div class="register-card">
    <h2>學生證實名註冊 (階段一)</h2>
    <p>請將學生證靠近讀卡機，或直接輸入 UID 模擬掃描：</p>
    
    <div class="input-group">
      <input v-model="uid" type="text" placeholder="例如: E2345678" @keyup.enter="handleRegister" autofocus />
      <button @click="handleRegister" :disabled="loading">
        {{ loading ? '註冊中...' : '模擬刷卡註冊' }}
      </button>
    </div>

    <div v-if="secretInfo" class="secret-box">
      <h3>⚠️ 請妥善保存您的投票憑證 ⚠️</h3>
      <p>這是您稍後匿名投票的唯一憑證，請勿外洩！</p>
      <div class="code">
        <strong>Nullifier:</strong> {{ secretInfo.nullifier }}<br/>
        <strong>Secret:</strong> {{ secretInfo.secret }}
      </div>
      <button @click="copySecrets">複製憑證</button>
    </div>

    <div v-if="message" :class="['message', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { generateSecrets, calculateCommitment } from '../utils/zk'

const uid = ref('')
const loading = ref(false)
const secretInfo = ref(null)
const message = ref('')
const messageType = ref('')

async function handleRegister() {
  if (!uid.value) {
    showMessage('請輸入學生證 UID', 'error')
    return
  }

  loading.value = true
  showMessage('', '')

  try {
    // 1. 鏈下生成秘密
    const secrets = generateSecrets()
    
    // 2. 計算 Commitment
    const commitment = await calculateCommitment(secrets.nullifier, secrets.secret)
    
    // 3. 傳送至後端 Relayer
    const res = await fetch('http://localhost:3000/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: uid.value, commitment })
    })
    
    const data = await res.json()
    
    if (res.ok && data.success) {
      secretInfo.value = secrets
      showMessage('註冊成功！Commitment 已發送至智能合約。', 'success')
      // 在實務上，前端應該要把 root 和 commitments 存下來，用來建構 Merkle Tree 的 Path
      localStorage.setItem('merkleRoot', data.root)
      localStorage.setItem('merkleTree', JSON.stringify(data.commitments))
      localStorage.setItem('myCommitment', commitment)
    } else {
      showMessage(data.error || '註冊失敗', 'error')
    }
  } catch (err) {
    showMessage('網路錯誤或伺服器未啟動', 'error')
  } finally {
    loading.value = false
  }
}

function showMessage(msg, type) {
  message.value = msg
  messageType.value = type
}

function copySecrets() {
  const text = `Nullifier: ${secretInfo.value.nullifier}\nSecret: ${secretInfo.value.secret}`
  navigator.clipboard.writeText(text)
  alert('已複製到剪貼簿')
}
</script>

<style scoped>
.register-card { text-align: center; }
.input-group { margin: 20px 0; }
input { padding: 10px; font-size: 16px; border: 1px solid #ccc; border-radius: 4px; margin-right: 10px; }
button { padding: 10px 20px; font-size: 16px; background-color: #2ecc71; color: white; border: none; border-radius: 4px; cursor: pointer; }
button:disabled { background-color: #95a5a6; }
.secret-box { margin-top: 20px; padding: 15px; background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; color: #856404; text-align: left;}
.code { font-family: monospace; background: #fff; padding: 10px; margin: 10px 0; border-radius: 4px; }
.message { margin-top: 20px; padding: 10px; border-radius: 4px; }
.success { background-color: #d4edda; color: #155724; }
.error { background-color: #f8d7da; color: #721c24; }
</style>
