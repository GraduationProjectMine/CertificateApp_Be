const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying CertificateRegistry to", network.name, "...\n");

  // Lấy deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📋 Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // Tên trường đại học
  const INSTITUTION_NAME = "Trường Đại học Blockchain Việt Nam";

  // Deploy contract
  console.log("⏳ Deploying CertificateRegistry...");
  const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
  const registry = await CertificateRegistry.deploy(INSTITUTION_NAME);

  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();
  console.log("✅ CertificateRegistry deployed to:", contractAddress);
  console.log("🏫 Institution Name:", INSTITUTION_NAME);
  console.log("👤 Owner/Admin:", deployer.address);

  // Lưu thông tin deployment
  const deploymentInfo = {
    network: network.name,
    contractAddress: contractAddress,
    deployer: deployer.address,
    institutionName: INSTITUTION_NAME,
    deployedAt: new Date().toISOString(),
    blockNumber: (await ethers.provider.getBlockNumber()).toString(),
  };

  // Tạo thư mục deployments nếu chưa có
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Lưu vào file JSON
  const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📄 Deployment info saved to:", deploymentFile);

  // Lưu ABI để backend/frontend sử dụng
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json"
  );

  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abiFile = path.join(deploymentsDir, "CertificateRegistry.abi.json");
    fs.writeFileSync(abiFile, JSON.stringify(artifact.abi, null, 2));
    console.log("📋 ABI saved to:", abiFile);
  }

  // Tạo file .env snippet cho backend
  const envSnippet = `
# ===== Blockchain Config (copy vào backend/.env và frontend/.env) =====
CONTRACT_ADDRESS=${contractAddress}
NETWORK=${network.name}
CHAIN_ID=${network.config?.chainId || 31337}
RPC_URL=${network.name === "localhost" ? "http://127.0.0.1:8545" : (process.env.SEPOLIA_RPC_URL || "")}
ADMIN_ADDRESS=${deployer.address}
`;
  console.log("\n🔧 Environment variables for backend/frontend:");
  console.log(envSnippet);

  // Nếu không phải local, in hướng dẫn verify
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n📡 To verify on Etherscan:");
    console.log(
      `npx hardhat verify --network ${network.name} ${contractAddress} "${INSTITUTION_NAME}"`
    );
  }

  console.log("\n✨ Deployment complete!\n");
  return contractAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });