// work-harvester.js
const { ethers } = require("ethers");

// 配置区域 - 在这里填写你的私钥（不要带0x前缀）
const WALLET_PRIVATE_KEY = "你的私钥";  // 示例：abcd1234...（64位长度）

const BARN_ADDRESS = "0x58BF26664c5013d58B8ea1E3Ef1F7BA60d64E356";
const WORKWARS_ADDRESS = "0x8A123AB13370408800a7C715aae8A131f6ED9A8F";


const BSC_RPC_ENDPOINTS = [
  "https://bsc.publicnode.com",
  "https://1rpc.io/bnb",
  "https://endpoints.omniatech.io/v1/bsc/mainnet/public",
  "https://bnb.api.onfinality.io/public",
  "https://bsc-mainnet.nodereal.io/v1/64a9df0874fb4a93b9d0a3849de012d3",
  "https://rpc.ankr.com/bsc",
  "https://bsc.nodereal.io",
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.binance.org/",
  "https://bsc-dataseed2.binance.org/",
  "https://bsc-dataseed3.binance.org/",
  "https://bsc-dataseed4.binance.org/"
];


const WORK_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];


const BARN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function claimManyFromOfficeAndBoardRoom(uint16[] calldata tokenIds, bool unstake) external",
  "function office(uint256) view returns (uint16 tokenId, uint80 value, address owner)"
];


async function connectToBSC() {
  for (const rpcUrl of BSC_RPC_ENDPOINTS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      // 测试连接
      await provider.getNetwork();
      console.log(`成功连接到BSC网络: ${rpcUrl}`);
      return provider;
    } catch (error) {
      console.log(`连接到 ${rpcUrl} 失败，尝试下一个节点...`);
    }
  }
  throw new Error("无法连接到任何BSC节点");
}


async function harvestWORK() {
  try {
    console.log("正在连接到BSC网络...");
    const provider = await connectToBSC();
    
    // 使用配置的私钥创建钱包实例
    const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);
    
    const workContract = new ethers.Contract(WORKWARS_ADDRESS, WORK_ABI, wallet);
    

    const balanceBefore = await workContract.balanceOf(wallet.address);
    const decimals = await workContract.decimals();
    

    const barnContract = new ethers.Contract(BARN_ADDRESS, BARN_ABI, wallet);
    
    console.log("正在查询质押的NFT...");
    
    const stakedCount = await barnContract.balanceOf(wallet.address);
    console.log(`找到 ${stakedCount} 个质押的NFT`);
    
    if (stakedCount.eq(0)) {
      console.log("没有质押的NFT，无需收获");
      return;
    }
    
    const stakedTokenIds = [];
    for (let i = 0; i < stakedCount; i++) {
      const tokenId = await barnContract.tokenOfOwnerByIndex(wallet.address, i);
      stakedTokenIds.push(tokenId);
      console.log(`发现质押的NFT #${tokenId}`);
    }
    
    const tokenIdsToHarvest = stakedTokenIds.map(id => Number(id));
    
    const gasLimit = 3000000; // 根据需要调整
    const gasPrice = await provider.getGasPrice(); // 自动获取当前gas价格
    console.log(`当前gas价格: ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei`);
    
    console.log("准备收获WORK代币...");
    
    // 调用合约收获收益，不解除质押(unstake=false)
    const tx = await barnContract.claimManyFromOfficeAndBoardRoom(
      tokenIdsToHarvest,
      false, // 不解除质押
      { 
        gasLimit,
        gasPrice: gasPrice.mul(12).div(10) // 使用当前gas价格的1.2倍以确保交易快速确认
      }
    );
    
    console.log(`交易已提交，等待确认: ${tx.hash}`);
    const receipt = await tx.wait();
    
    const balanceAfter = await workContract.balanceOf(wallet.address);
    
    const harvestedAmount = balanceAfter.sub(balanceBefore);
    console.log(`成功收获 ${ethers.utils.formatUnits(harvestedAmount, decimals)} 个WORK代币!`);
    
    const gasCostInBNB = receipt.gasUsed.mul(gasPrice).mul(12).div(10); // 因为用了1.2倍的gasPrice
    console.log(`区块号: ${receipt.blockNumber}`);
    console.log(`交易哈希: ${receipt.transactionHash}`);
    console.log(`gas使用量: ${receipt.gasUsed.toString()}`);
    console.log(`花费的BNB: ${ethers.utils.formatEther(gasCostInBNB)} BNB`);
    
  } catch (error) {
    console.error("收获WORK失败:", error.message);
    if (error.code) {
      console.error("错误代码:", error.code);
    }
  }
}

harvestWORK(); 