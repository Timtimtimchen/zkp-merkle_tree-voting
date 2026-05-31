const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const buildPoseidon = require('circomlibjs').buildPoseidon;
const pool = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

// 設定智能合約相關資訊 (請在部署後修改)
const RPC_URL = "http://192.168.202.129:8545"; // 私有鏈 RPC
const PRIVATE_KEY = "0xddb8c44214930d382ab43f3563173c22e2424a54038d938ad662add5274058ea"; // 您的真實私鑰
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

// 階段一：註冊 (實名認證)
app.post('/register', async (req, res) => {
  const { uid, commitment } = req.body;

  try {
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
    // 從區塊鏈智能合約讀取票數 (公開變數 votes 的 getter 方法)
    // 我們使用 provider 而非 wallet 來呼叫，因為讀取不需手續費
    const readonlyContract = new ethers.Contract(CONTRACT_ADDRESS, [
      "function votes(uint256 candidate) view returns (uint256)"
    ], provider);
    
    const votes1 = await readonlyContract.votes(1);
    const votes2 = await readonlyContract.votes(2);

    res.json({
      success: true,
      candidate1: Number(votes1),
      candidate2: Number(votes2)
    });
  } catch (err) {
    console.error("Failed to fetch results from blockchain:", err);
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Relayer backend listening on port ${PORT}`);
});
