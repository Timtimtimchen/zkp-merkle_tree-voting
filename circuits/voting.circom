pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";

// Merkle Tree checker template
template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    s * (1 - s) === 0;
    out[0] <== (in[1] - in[0])*s + in[0];
    out[1] <== (in[0] - in[1])*s + in[1];
}

template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component selectors[levels];
    component hashers[levels];

    for (var i = 0; i < levels; i++) {
        selectors[i] = DualMux();
        selectors[i].in[0] <== i == 0 ? leaf : hashers[i - 1].out;
        selectors[i].in[1] <== pathElements[i];
        selectors[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== selectors[i].out[0];
        hashers[i].inputs[1] <== selectors[i].out[1];
    }

    root === hashers[levels - 1].out;
}

// Main Voting template
template Voting(levels) {
    // Public inputs
    signal input root;
    signal input nullifierHash;
    signal input candidate;

    // Private inputs
    signal input nullifier;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // 1. Calculate Commitment (Poseidon of nullifier and secret)
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== nullifier;
    commitmentHasher.inputs[1] <== secret;

    // 2. Check Merkle Tree Inclusion
    component treeChecker = MerkleTreeChecker(levels);
    treeChecker.leaf <== commitmentHasher.out;
    treeChecker.root <== root;
    for (var i = 0; i < levels; i++) {
        treeChecker.pathElements[i] <== pathElements[i];
        treeChecker.pathIndices[i] <== pathIndices[i];
    }

    // 3. Check Nullifier Hash
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHasher.out === nullifierHash;

    // 4. Dummy constraint to tie the candidate to the proof
    // This ensures the proof cannot be front-run with a different candidate
    signal candidateSquare;
    candidateSquare <== candidate * candidate;
}

// We use 20 levels for the Merkle tree (supports up to 2^20 votes)
component main {public [root, nullifierHash, candidate]} = Voting(20);
