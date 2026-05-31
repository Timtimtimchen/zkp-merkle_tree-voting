import { buildPoseidon } from 'circomlibjs';

let poseidon = null;

async function getPoseidon() {
  if (!poseidon) {
    poseidon = await buildPoseidon();
  }
  return poseidon;
}

let zeroHashes = null;
async function getZeroHashes() {
  if (zeroHashes) return zeroHashes;
  const p = await getPoseidon();
  zeroHashes = ["0"];
  for (let i = 0; i < 20; i++) {
    const prev = BigInt(zeroHashes[i]);
    const hash = p([prev, prev]);
    zeroHashes.push(p.F.toString(hash));
  }
  return zeroHashes;
}

/**
 * 產生隨機的 Nullifier 與 Secret
 */
export function generateSecrets() {
  // 在實際應用中應使用加密安全的隨機數
  const nullifier = Math.floor(Math.random() * 1000000000).toString();
  const secret = Math.floor(Math.random() * 1000000000).toString();
  return { nullifier, secret };
}

/**
 * 計算 Commitment = Poseidon(Nullifier, Secret)
 */
export async function calculateCommitment(nullifier, secret) {
  const p = await getPoseidon();
  const hash = p([BigInt(nullifier), BigInt(secret)]);
  return p.F.toString(hash);
}

/**
 * 計算 Nullifier Hash = Poseidon(Nullifier)
 */
export async function calculateNullifierHash(nullifier) {
  const p = await getPoseidon();
  const hash = p([BigInt(nullifier)]);
  return p.F.toString(hash);
}

/**
 * 計算 Merkle Path
 */
export async function generateMerkleProof(commitments, leaf) {
  const p = await getPoseidon();
  const zeros = await getZeroHashes();
  
  let index = commitments.findIndex(c => c === leaf);
  if (index === -1) throw new Error("您尚未註冊或憑證錯誤！");

  let pathElements = [];
  let pathIndices = [];
  
  let currentLevel = [...commitments];
  const depth = 20;
  
  let currentIndex = index;

  for (let i = 0; i < depth; i++) {
    pathIndices.push(currentIndex % 2);
    
    // Find sibling
    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
    let sibling = zeros[i];
    if (siblingIndex < currentLevel.length) {
      sibling = currentLevel[siblingIndex];
    }
    pathElements.push(sibling);

    // Calculate next level
    const nextLevel = [];
    for (let j = 0; j < currentLevel.length; j += 2) {
      const left = currentLevel[j];
      const right = j + 1 < currentLevel.length ? currentLevel[j + 1] : zeros[i];
      const hash = p([BigInt(left), BigInt(right)]);
      nextLevel.push(p.F.toString(hash));
    }
    currentLevel = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }

  const root = currentLevel[0];
  return { root, pathElements, pathIndices };
}

/**
 * 產生 ZK Proof
 */
export async function generateProof(nullifier, secret, candidate, root, pathElements, pathIndices) {
  const input = {
    root: root,
    nullifierHash: await calculateNullifierHash(nullifier),
    candidate: candidate,
    nullifier: nullifier,
    secret: secret,
    pathElements: pathElements,
    pathIndices: pathIndices
  };

  // snarkjs 在 index.html 中透過 CDN 引入為全域變數
  // 需要確保編譯好的 voting_0000.wasm 與 voting_final.zkey 放在 public 資料夾下
  const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
    input,
    "/voting.wasm",
    "/voting_final.zkey"
  );
  
  return { proof, publicSignals };
}
