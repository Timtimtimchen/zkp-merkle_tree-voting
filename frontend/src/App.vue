<template>
  <div class="app-wrapper">
    <div class="glass-container">
      <header class="app-header">
        <h1>Zero-Knowledge <span>Voting</span></h1>
        <p class="subtitle">Secure, Anonymous, Decentralized</p>
      </header>
      
      <nav class="nav-tabs">
        <button :class="{ active: currentTab === 'register' }" @click="currentTab = 'register'">
          <span class="step-num">1</span>實名註冊
        </button>
        <button :class="{ active: currentTab === 'vote' }" @click="currentTab = 'vote'">
          <span class="step-num">2</span>匿名投票
        </button>
        <button :class="{ active: currentTab === 'results' }" @click="currentTab = 'results'">
          <span class="step-num">3</span>開票結果
        </button>
        <button :class="{ active: currentTab === 'admin' }" @click="currentTab = 'admin'" class="admin-tab">
          ⚙️ 後台管理
        </button>
      </nav>
      
      <main class="content-area">
        <transition name="fade" mode="out-in">
          <Register v-if="currentTab === 'register'" />
          <Vote v-else-if="currentTab === 'vote'" />
          <Results v-else-if="currentTab === 'results'" />
          <Admin v-else-if="currentTab === 'admin'" />
        </transition>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Register from './components/Register.vue'
import Vote from './components/Vote.vue'
import Results from './components/Results.vue'
import Admin from './components/Admin.vue'

const currentTab = ref('register')
</script>

<style>
:root {
  --brand-color: #6366f1;
  --brand-dark: #4f46e5;
  --bg-gradient: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --text-tertiary: #94a3b8;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  margin: 0;
  padding: 0;
  background-image: var(--bg-gradient);
  background-attachment: fixed;
  color: var(--text-primary);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

.app-wrapper {
  display: flex;
  justify-content: center;
  padding: 2rem 1rem;
  min-height: 100vh;
  box-sizing: border-box;
}

.glass-container {
  width: 100%;
  max-width: 850px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 24px;
  padding: 2.5rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255,255,255,1);
}

.app-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.app-header h1 {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0;
  color: var(--text-primary);
  letter-spacing: -1px;
}

.app-header h1 span {
  background: linear-gradient(to right, var(--brand-color), #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
  font-weight: 500;
}

.nav-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  background: rgba(241, 245, 249, 0.8);
  padding: 0.5rem;
  border-radius: 16px;
  margin-bottom: 2rem;
}

.nav-tabs button {
  flex: 1;
  min-width: 120px;
  padding: 0.8rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.95rem;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.step-num {
  background: rgba(0,0,0,0.05);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.75rem;
  transition: all 0.3s;
}

.nav-tabs button:hover {
  background: rgba(255, 255, 255, 0.5);
  color: var(--text-primary);
}

.nav-tabs button.active {
  background: white;
  color: var(--brand-color);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

.nav-tabs button.active .step-num {
  background: var(--brand-color);
  color: white;
}

.admin-tab {
  flex: 0.5 !important;
  background: rgba(226, 232, 240, 0.5) !important;
}

.content-area {
  min-height: 300px;
}

/* Global Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-in {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
