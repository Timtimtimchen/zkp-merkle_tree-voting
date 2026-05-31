// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// 這是由 snarkjs 自動產生的 Verifier 介面
interface IVerifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[3] memory input // [root, nullifierHash, candidate]
    ) external view returns (bool);
}

contract Voting {
    IVerifier public verifier;
    
    // 儲存所有已知的 Merkle Root，讓選民可以使用歷史 Root 進行投票
    // 避免在生成 ZK Proof 的過程中，有新的人註冊導致 Root 改變而驗證失敗
    mapping(uint256 => bool) public knownRoots;
    uint256 public currentRoot;
    
    // 記錄已經投過票的作廢碼 (Nullifier Hash)，防止重複投票
    mapping(uint256 => bool) public nullifierHashes;
    
    // 記錄各候選人的得票數 (candidate ID => votes)
    mapping(uint256 => uint256) public votes;
    
    // 負責代付 Gas 費與管理 Merkle Tree 的 Relayer (中繼器) 帳號
    address public relayer;

    event VoteCast(uint256 indexed candidate, uint256 nullifierHash);
    event RootUpdated(uint256 newRoot);

    constructor(address _verifier) {
        verifier = IVerifier(_verifier);
        relayer = msg.sender;
    }

    // 階段一：註冊 (由 Relayer 呼叫)
    // 為了降低系統複雜度與部署成本，在此架構下我們將 Merkle Tree 的計算放在 Relayer 後端。
    // Relayer 收到新學生的註冊後，會更新樹並將新的 Root 送上鏈。
    // 如果要完全去中心化，可以在合約內實作 Poseidon Hash 函數並在鏈上計算 Merkle Tree。
    function updateRoot(uint256 _newRoot) external {
        require(msg.sender == relayer, "Only relayer can update root");
        currentRoot = _newRoot;
        knownRoots[_newRoot] = true;
        emit RootUpdated(_newRoot);
    }

    // 階段二：投票 (任何人皆可呼叫，通常由 Relayer 代發以節省學生的 Gas)
    function vote(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint256 root,
        uint256 nullifierHash,
        uint256 candidate
    ) external {
        // 1. 確認這個 Proof 是基於某個合法的 Merkle Root 產生的
        require(knownRoots[root], "Unknown Merkle root");
        
        // 2. 確認這個 Nullifier 以前沒用過 (防止重複投票)
        require(!nullifierHashes[nullifierHash], "Nullifier already used - double voting");
        
        // 3. 組合 Public Inputs：陣列順序必須與 circom 輸出的 main public inputs 順序一致
        uint[3] memory input = [root, nullifierHash, candidate];
        
        // 4. 呼叫 ZK Verifier 驗證密碼學證明
        require(verifier.verifyProof(a, b, c, input), "Invalid ZK Proof");
        
        // 5. 驗證通過！將作廢碼標記為已使用
        nullifierHashes[nullifierHash] = true;
        
        // 6. 給候選人加票
        votes[candidate] += 1;
        
        emit VoteCast(candidate, nullifierHash);
    }
}
