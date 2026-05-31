const hre = require("hardhat");

async function main() {
  console.log("正在部署合約...");

  // 1. 部署 Verifier 合約 (由 Circom 產生的 ZK 驗證合約)
  // 如果尚未編譯出 Verifier.sol，這裡會報錯。你需要先執行 circuits 裡的 compile.ps1
  const Verifier = await hre.ethers.getContractFactory("Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log(`Verifier 部署成功，地址為: ${verifierAddress}`);

  // 2. 部署 Voting 合約，並將 Verifier 地址傳入 constructor
  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy(verifierAddress);
  await voting.waitForDeployment();
  const votingAddress = await voting.getAddress();

  console.log(`\n🎉 Voting 投票主合約部署成功！`);
  console.log(`✅ 請將以下地址複製到 backend/server.js 的 CONTRACT_ADDRESS 中：`);
  console.log(`👉 ${votingAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
