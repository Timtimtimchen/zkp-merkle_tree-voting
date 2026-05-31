<template>
  <div class="vote-card">
    <h2>零知識匿名投票 (階段二)</h2>
    <p>在此輸入您的憑證。此步驟將在本地產生密碼學證明，您的秘密不會上傳到伺服器！</p>
    
    <div class="form-group">
      <label>Nullifier:</label>
      <input v-model="nullifier" type="text" />
    </div>
    <div class="form-group">
      <label>Secret:</label>
      <input v-model="secret" type="text" />
    </div>
    
    <div class="form-group">
      <label>選擇候選人:</label>
      <select v-model="candidate">
        <option value="1">1號: Alice</option>
        <option value="2">2號: Bob</option>
      </select>
    </div>

    <button @click="handleVote" :disabled="loading">
      {{ loading ? '產生證明並投票中...' : '送出選票' }}
    </button>

    <div v-if="message" :class="['message', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { generateProof, calculateNullifierHash, generateMerkleProof, calculateCommitment } from '../utils/zk'

const nullifier = ref('')
const secret = ref('')
const candidate = ref('1')
const loading = ref(false)
const message = ref('')
const messageType = ref('')

async function handleVote() {
  if (!nullifier.value || !secret.value) {
    showMessage('請填寫完整的憑證', 'error')
    return
  }

  loading.value = true
  showMessage('正在本地計算零知識證明...', 'info')

  try {
    // 實務上要從智能合約或後端取得最新的 Merkle Tree 狀態來建構 Path
    // 這裡我們簡化，從 localStorage 拿剛才註冊的 Tree，並假裝建構了 Path
    const commitments = JSON.parse(localStorage.getItem('merkleTree') || "[]")
    
    // 根據使用者輸入的密碼，計算出他的 Commitment (Leaf)
    const leaf = await calculateCommitment(nullifier.value.trim(), secret.value.trim())
    
    // 在本地使用真實的 Poseidon Hash 重構 Merkle Path
    const { root, pathElements, pathIndices } = await generateMerkleProof(commitments, leaf)

    const { proof, publicSignals } = await generateProof(
      nullifier.value.trim(),
      secret.value.trim(),
      candidate.value,
      root,
      pathElements,
      pathIndices
    )

    showMessage('證明產生完成，正在由 Relayer 發送交易...', 'info')
    
    // 解析 snarkjs 的 proof 格式轉換為 Solidity 接受的格式
    const a = [proof.pi_a[0], proof.pi_a[1]]
    const b = [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]]
    const c = [proof.pi_c[0], proof.pi_c[1]]
    
    // 傳送給 Relayer
    const res = await fetch('http://localhost:3000/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        a, b, c,
        root: publicSignals[0],
        nullifierHash: publicSignals[1],
        candidate: publicSignals[2]
      })
    })

    const data = await res.json()
    if (res.ok && data.success) {
      showMessage('✅ 投票成功！交易已上鏈。', 'success')
    } else {
      showMessage(data.error || '投票失敗', 'error')
    }
  } catch (err) {
    console.error(err)
    showMessage('發生錯誤，請檢查憑證或網路連線。', 'error')
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
.vote-card { text-align: left; }
.form-group { margin-bottom: 15px; }
label { display: block; margin-bottom: 5px; font-weight: bold; }
input, select { width: 100%; padding: 10px; font-size: 16px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
button { width: 100%; padding: 12px; font-size: 18px; background-color: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px; }
button:disabled { background-color: #95a5a6; }
.message { margin-top: 20px; padding: 10px; border-radius: 4px; text-align: center;}
.success { background-color: #d4edda; color: #155724; }
.error { background-color: #f8d7da; color: #721c24; }
.info { background-color: #d1ecf1; color: #0c5460; }
</style>
