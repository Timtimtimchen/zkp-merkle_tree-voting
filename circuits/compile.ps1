# compile.ps1
# This script compiles the voting.circom circuit, generates the zkey, and exports the Verifier.sol

Write-Host "Installing dependencies..."
npm install

Write-Host "Compiling the circuit..."
# Assuming circom is installed globally or available in PATH.
circom voting.circom --r1cs --wasm --sym

Write-Host "Generating powers of tau..."
npx snarkjs powersoftau new bn128 14 pot14_0000.ptau -v
npx snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name="First contribution" -v -e="some random text"
npx snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau -v

Write-Host "Generating zkey..."
npx snarkjs groth16 setup voting.r1cs pot14_final.ptau voting_0000.zkey
npx snarkjs zkey contribute voting_0000.zkey voting_final.zkey --name="Second contribution" -v -e="more random text"
npx snarkjs zkey export verificationkey voting_final.zkey verification_key.json

Write-Host "Exporting Verifier.sol..."
npx snarkjs zkey export solidityverifier voting_final.zkey ../contracts/Verifier.sol

Write-Host "Done!"
