require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.19",
  networks: {
    // 預留給 Geth 私有鏈的設定
    geth: {
      url: "http://192.168.202.129:8545",
      // 將使用實驗室富豪帳戶的私鑰
      accounts: ["0xa414BF9e2D26C4F98eEAD4F94C103fC89D0e1969"] // 填入 Private Key
    }
  }
};
