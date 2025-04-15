const { ethers } = require("ethers");

// 配置区域 - 在这里填写你的私钥（不要带0x前缀）
const WALLET_PRIVATE_KEY = "你的私钥";  // 示例：abcd1234...（64位长度）


const BARN_ADDRESS = "0x58BF26664c5013d58B8ea1E3Ef1F7BA60d64E356";
const WORKWARS_ADDRESS = "0x8A123AB13370408800a7C715aae8A131f6ED9A8F";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // PancakeSwap Router V2
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955"; // BSC上的USDT
const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"; // WBNB地址


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
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) external returns (bool)"
];


const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
];


const USDT_ABI = [
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
      await provider.getNetwork();
      console.log(`成功连接到BSC网络: ${rpcUrl}`);
      return provider;
    } catch (error) {
      console.log(`连接到 ${rpcUrl} 失败，尝试下一个节点...`);
    }
  }
  throw new Error("无法连接到任何BSC节点");
}


async function userConfirm(message) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    readline.question(message + ' (y/n): ', (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}


async function swapWORKtoUSDT(wallet, workAmount) {
  try {
    const provider = wallet.provider;
    

    const workContract = new ethers.Contract(WORKWARS_ADDRESS, WORK_ABI, wallet);
    const routerContract = new ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, wallet);
    const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, wallet);
    

    const workDecimals = await workContract.decimals();
    const usdtDecimals = await usdtContract.decimals();
    

    const path = [WORKWARS_ADDRESS, WBNB_ADDRESS, USDT_ADDRESS];
    let expectedUSDT = ethers.BigNumber.from(0);
    
    try {
      const amounts = await routerContract.getAmountsOut(workAmount, path);
      expectedUSDT = amounts[2]; // 获取最终USDT数量
      console.log(`使用路径 WORK -> WBNB -> USDT 预计可兑换: ${ethers.utils.formatUnits(expectedUSDT, usdtDecimals)} USDT`);
    } catch (e) {
        console.error("无法通过 WORK -> WBNB -> USDT 路径获取兑换数量", e.message);
        return false;
    }
    
    if (expectedUSDT.eq(0)) {
      console.log("预计兑换数量为0，取消兑换");
      return false;
    }
    

    const confirmed = await userConfirm('是否确认兑换？');
    if (!confirmed) {
      console.log('用户取消兑换');
      return;
    }
    
 
    console.log('正在授权PancakeSwap...');
    const approveTx = await workContract.approve(PANCAKE_ROUTER, workAmount);
    await approveTx.wait();
    console.log('授权完成');
    
    // 设置滑点为1%
    const amountOutMin = expectedUSDT.mul(99).div(100);
    

    console.log('正在执行兑换...');
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20分钟过期
    const swapTx = await routerContract.swapExactTokensForTokens(
      workAmount,
      amountOutMin,
      path, 
      wallet.address,
      deadline,
      {
        gasLimit: 300000, 
        gasPrice: (await provider.getGasPrice()) // 使用当前gas价格
      }
    );
    
    console.log(`兑换交易已提交: ${swapTx.hash}`);
    const receipt = await swapTx.wait();
    

    const usdtBalanceAfter = await usdtContract.balanceOf(wallet.address);
    console.log(`兑换完成！当前USDT余额: ${ethers.utils.formatUnits(usdtBalanceAfter, usdtDecimals)} USDT`);
    

    const gasCostInBNB = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    console.log(`兑换花费的BNB: ${ethers.utils.formatEther(gasCostInBNB)} BNB`);
    
    return true;
  } catch (error) {
    console.error('兑换失败:', error.message);
    if (error.data) {
      console.error('错误数据:', error.data);
    }
    return false;
  }
}


async function harvestWORK() {
  try {
    console.log("正在连接到BSC网络...");
    const provider = await connectToBSC();
    

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
    
    // 获取所有质押的tokenId
    const stakedTokenIds = [];
    for (let i = 0; i < stakedCount; i++) {
      const tokenId = await barnContract.tokenOfOwnerByIndex(wallet.address, i);
      stakedTokenIds.push(tokenId);
      console.log(`发现质押的NFT #${tokenId}`);
    }
    

    const tokenIdsToHarvest = stakedTokenIds.map(id => Number(id));
    

    const gasLimit = 300000; 
    const gasPrice = await provider.getGasPrice(); 
    console.log(`当前gas价格: ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei`);
    

    const estimatedGasFee = ethers.utils.formatEther(gasPrice.mul(gasLimit));
    console.log(`估计gas费用: ${estimatedGasFee} BNB`);
    
    console.log("准备收获WORK代币...");
    
    // 调用合约收获收益，不解除质押(unstake=false)
    const tx = await barnContract.claimManyFromOfficeAndBoardRoom(
      tokenIdsToHarvest,
      false, // 不解除质押
      { 
        gasLimit,
        gasPrice 
      }
    );
    
    console.log(`交易已提交，等待确认: ${tx.hash}`);
    const receipt = await tx.wait();
    

    const balanceAfter = await workContract.balanceOf(wallet.address);
    

    const harvestedAmount = balanceAfter.sub(balanceBefore);
    console.log(`成功收获 ${ethers.utils.formatUnits(harvestedAmount, decimals)} 个WORK代币!`);
    

    const gasCostInBNB = receipt.gasUsed.mul(gasPrice); 
    console.log(`区块号: ${receipt.blockNumber}`);
    console.log(`交易哈希: ${receipt.transactionHash}`);
    console.log(`gas使用量: ${receipt.gasUsed.toString()}`);
    console.log(`花费的BNB: ${ethers.utils.formatEther(gasCostInBNB)} BNB`);
    
 
    if (harvestedAmount.gt(0)) {
      const confirmed = await userConfirm('是否将收获的WORK兑换成USDT？');
      if (confirmed) {
        await swapWORKtoUSDT(wallet, harvestedAmount);
      }
    }
    
  } catch (error) {
    console.error("收获WORK失败:", error.message);
    if (error.code) {
      console.error("错误代码:", error.code);
    }
  }
}


harvestWORK(); 