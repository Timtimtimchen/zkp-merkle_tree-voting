const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const buildPoseidon = require('circomlibjs').buildPoseidon;
const { pool, initDB } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

// 設定智能合約相關資訊 (請在部署後修改)
const RPC_URL = "http://192.168.202.129:8545"; // 私有鏈 RPC
const PRIVATE_KEY = ""; // 您的真實私鑰
const CONTRACT_ADDRESS = "0x98Eb22D120Cb55b03eb5304712a388AbF63152E6"; // 部署後的 Voting 合約地址
const VOTING_ABI = [
  "function updateRoot(uint256 _newRoot) external",
  "function vote(uint[2] a, uint[2][2] b, uint[2] c, uint256 root, uint256 nullifierHash, uint256 candidate) external"
];

// 本地維護的 Merkle Tree 陣列
const commitments = [];
const TREE_LEVELS = 20;

let poseidon;
let provider, wallet, votingContract;

async function init() {
  poseidon = await buildPoseidon();
  
  // 載入資料庫中已存的 commitments
  try {
    await initDB();
    const [rows] = await pool.query('SELECT value FROM commitments ORDER BY id ASC');
    for (const row of rows) {
      commitments.push(BigInt(row.value));
    }
    console.log(`[Relayer] Loaded ${commitments.length} commitments from database.`);
  } catch (err) {
    console.error("Failed to load commitments from DB:", err);
  }
  
  // 初始化區塊鏈連線 (真實節點連線已啟用)
  provider = new ethers.JsonRpcProvider(RPC_URL);
  wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  votingContract = new ethers.Contract(CONTRACT_ADDRESS, VOTING_ABI, wallet);
}
init();

// 預先計算好的空樹節點雜湊值，用來大幅加速 Merkle Tree 計算
let zeroHashes = null;
function getZeroHashes() {
  if (zeroHashes) return zeroHashes;
  zeroHashes = ["0"];
  for (let i = 0; i < TREE_LEVELS; i++) {
    const prev = BigInt(zeroHashes[i]);
    const hash = poseidon([prev, prev]);
    zeroHashes.push(poseidon.F.toString(hash));
  }
  return zeroHashes;
}

// 計算 Merkle Root (Poseidon Hash) - 優化版
function calculateRoot(leaves) {
  if (leaves.length === 0) return "0";
  const zeros = getZeroHashes();
  let currentLevel = [...leaves];

  for (let i = 0; i < TREE_LEVELS; i++) {
    const nextLevel = [];
    for (let j = 0; j < currentLevel.length; j += 2) {
      const left = currentLevel[j];
      const right = j + 1 < currentLevel.length ? currentLevel[j + 1] : zeros[i];
      const hash = poseidon([BigInt(left), BigInt(right)]);
      nextLevel.push(poseidon.F.toString(hash));
    }
    currentLevel = nextLevel;
  }
  return currentLevel[0];
}

// 取得系統設定
async function getSettings() {
  const [rows] = await pool.query('SELECT * FROM settings');
  const settings = {};
  for (const row of rows) {
    settings[row.setting_key] = row.setting_value === 'true';
  }
  return settings;
}

// 階段一：註冊 (實名認證)
app.post('/register', async (req, res) => {
  const { uid, commitment } = req.body;

  try {
    const settings = await getSettings();
    if (!settings.is_voting_open) {
      return res.status(403).json({ error: "Voting is currently closed." });
    }

    const [rows] = await pool.query('SELECT * FROM students WHERE uid = ?', [uid]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Student not found or unregistered." });
    }
    
    if (rows[0].has_voted) {
      return res.status(403).json({ error: "Student has already registered for voting." });
    }

    // 標記為已投票(已註冊)
    await pool.query('UPDATE students SET has_voted = 1 WHERE uid = ?', [uid]);

    // 加入 Merkle Tree 並寫入資料庫
    commitments.push(BigInt(commitment));
    await pool.query('INSERT INTO commitments (value) VALUES (?)', [commitment.toString()]);
    
    const newRoot = calculateRoot(commitments);

    // [Relayer] 發送交易上鏈更新 Root
    const tx = await votingContract.updateRoot(newRoot);
    await tx.wait();

    console.log(`[Register] UID: ${uid}, Commitment: ${commitment}, New Root: ${newRoot}`);

    res.json({ success: true, root: newRoot.toString(), commitments: commitments.map(c => c.toString()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 階段二：投票 (Relayer 幫忙發交易)
app.post('/vote', async (req, res) => {
  const { a, b, c, root, nullifierHash, candidate } = req.body;
  
  try {
    const settings = await getSettings();
    if (!settings.is_voting_open) {
      return res.status(403).json({ error: "Voting is currently closed." });
    }

    // [Relayer] 發送零知識投票交易
    const tx = await votingContract.vote(a, b, c, root, nullifierHash, candidate);
    await tx.wait();
    
    console.log(`[Vote] Relayed vote for candidate ${candidate}`);
    res.json({ success: true, message: "Vote cast successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Transaction failed." });
  }
});

// 階段三：查詢結果
app.get('/results', async (req, res) => {
  try {
    const readonlyContract = new ethers.Contract(CONTRACT_ADDRESS, [
      "function votes(uint256 candidate) view returns (uint256)"
    ], provider);
    
    // 從資料庫取得所有候選人
    const [candidates] = await pool.query('SELECT * FROM candidates ORDER BY id ASC');
    
    // 查詢每位候選人的得票數
    const results = [];
    const settings = await getSettings();
    
    for (const c of candidates) {
      // 若隱藏結果，強制票數為 0
      const voteCount = settings.hide_results ? 0n : await readonlyContract.votes(c.id);
      results.push({
        id: c.id,
        name: c.name,
        votes: Number(voteCount)
      });
    }

    res.json({
      success: true,
      data: results
    });
  } catch (err) {
    console.error("Failed to fetch results from blockchain:", err);
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

// 後台：取得所有候選人
app.get('/candidates', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM candidates ORDER BY id ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch candidates" });
  }
});

// 後台：新增候選人
app.post('/candidates', async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') return res.status(400).json({ error: "Name is required" });
  
  try {
    const [result] = await pool.query('INSERT INTO candidates (name) VALUES (?)', [name.trim()]);
    res.json({ success: true, id: result.insertId, name: name.trim() });
  } catch (err) {
    res.status(500).json({ error: "Failed to add candidate" });
  }
});

// 後台：刪除候選人
app.delete('/candidates/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM candidates WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete candidate" });
  }
});

// 後台：取得系統設定
app.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// 後台：更新系統設定
app.post('/settings', async (req, res) => {
  const { is_voting_open, hide_results } = req.body;
  try {
    if (is_voting_open !== undefined) {
      await pool.query('UPDATE settings SET setting_value = ? WHERE setting_key = "is_voting_open"', [is_voting_open ? 'true' : 'false']);
    }
    if (hide_results !== undefined) {
      await pool.query('UPDATE settings SET setting_value = ? WHERE setting_key = "hide_results"', [hide_results ? 'true' : 'false']);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// 後台：取得白名單選民
app.get('/students', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, uid, has_voted FROM students ORDER BY id DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// 後台：新增選民
app.post('/students', async (req, res) => {
  const { uid } = req.body;
  if (!uid || uid.trim() === '') return res.status(400).json({ error: "UID is required" });
  try {
    await pool.query('INSERT INTO students (uid) VALUES (?)', [uid.trim()]);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: "Student UID already exists" });
    }
    res.status(500).json({ error: "Failed to add student" });
  }
});

// 後台：刪除選民
app.delete('/students/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    await pool.query('DELETE FROM students WHERE uid = ?', [uid]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete student" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Relayer backend listening on port ${PORT}`);
});
