<template>
  <div class="container">
    <h1>ZK-SNARKs E-Voting 系統</h1>
    <div class="tabs">
      <button :class="{ active: currentTab === 'register' }" @click="currentTab = 'register'">階段一：實名註冊</button>
      <button :class="{ active: currentTab === 'vote' }" @click="currentTab = 'vote'">階段二：匿名投票</button>
      <button :class="{ active: currentTab === 'results' }" @click="currentTab = 'results'">階段三：開票結果</button>
    </div>
    
    <div class="content">
      <Register v-if="currentTab === 'register'" />
      <Vote v-if="currentTab === 'vote'" />
      <Results v-if="currentTab === 'results'" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Register from './components/Register.vue'
import Vote from './components/Vote.vue'
import Results from './components/Results.vue'

const currentTab = ref('register')
</script>

<style>
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f4f7f6;
  color: #333;
}
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}
h1 {
  text-align: center;
  color: #2c3e50;
}
.tabs {
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
}
.tabs button {
  padding: 10px 20px;
  margin: 0 10px;
  border: none;
  background-color: #ddd;
  cursor: pointer;
  border-radius: 5px;
  font-size: 16px;
}
.tabs button.active {
  background-color: #3498db;
  color: white;
}
.content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
</style>
