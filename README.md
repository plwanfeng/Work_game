# WORK代币收益一键提取

这是一个简单的脚本，用于自动收获WorkWars游戏中质押NFT产生的WORK代币收益。

## 功能特点

- 自动查询用户质押的所有NFT
- 一键收获所有NFT的WORK代币收益
- 可通过定时任务实现自动收益收集
- 增加SWap功能，一键兑换为USDT

## 安装步骤

1. 确保已安装Node.js (v14+)

2. 克隆或下载此仓库

3. 安装依赖:
```bash
npm install
```

4. 配置钱包:
   - 在work-harvester.js文件中填入你的钱包私钥，不要带0x

## 使用方法

运行脚本收获收益:
```bash
node work-harvester.js
```

![880fc6ad-7796-441b-8e49-e8db9b7fdde1](https://github.com/user-attachments/assets/df63a348-0e19-4ce4-911f-43b1573f93ab)


## 安全注意事项

⚠️ **重要警告**:

1. **私钥安全**:
   - 永远不要分享你的私钥


2. **定时任务设置**:
   - 可以使用cron等工具设置定时运行
   - 示例cron配置 (每天中午12点运行):
     ```
     0 12 * * * cd /path/to/script && node work-harvester.js >> harvest.log 2>&1
     ```

## 免责声明

本脚本仅供学习和个人使用。使用者需自行承担使用风险。请确保了解区块链操作的潜在风险，包括但不限于智能合约风险、私钥泄露风险等。 
