import { ethers } from "hardhat";

async function main() {
  const VEILR_ADDRESS = "0xd667A750C3dba0436eBd47dC5a57B6D7BA49045e";
  
  console.log("Starting MockLender deployment to Sepolia...");
  console.log("Veilr Address:", VEILR_ADDRESS);

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("Deployer account has no ETH. Please fund it with Sepolia ETH.");
  }

  // Deploy MockLender
  const MockLender = await ethers.getContractFactory("MockLender");
  console.log("Deploying MockLender...");
  const mockLender = await MockLender.deploy(VEILR_ADDRESS);
  await mockLender.waitForDeployment();

  const mockLenderAddress = await mockLender.getAddress();
  console.log("✅ MockLender deployed to:", mockLenderAddress);

  console.log("\n================================");
  console.log("MockLender Address:", mockLenderAddress);
  console.log("Linked to Veilr:  ", VEILR_ADDRESS);
  console.log("Network:           Ethereum Sepolia Testnet (chainId 11155111)");
  console.log("================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
