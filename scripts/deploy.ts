import { ethers } from "hardhat";

async function main() {
  console.log("Starting Veilr deployment to Sepolia...");

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("Deployer account has no ETH. Please fund it with Sepolia ETH.");
  }

  // Deploy Veilr
  const Veilr = await ethers.getContractFactory("Veilr");
  console.log("Deploying Veilr...");
  const veilr = await Veilr.deploy();
  await veilr.waitForDeployment();

  const veilrAddress = await veilr.getAddress();
  console.log("✅ Veilr deployed to:", veilrAddress);

  // Assign all roles to deployer for initial testing
  const SENDER_ROLE = await veilr.SENDER_ROLE();
  const COMPLIANCE_ROLE = await veilr.COMPLIANCE_ROLE();
  const REGULATOR_ROLE = await veilr.REGULATOR_ROLE();

  console.log("\nAssigning roles to deployer...");
  await (await veilr.grantRole(SENDER_ROLE, deployer.address)).wait();
  await (await veilr.grantRole(COMPLIANCE_ROLE, deployer.address)).wait();
  await (await veilr.grantRole(REGULATOR_ROLE, deployer.address)).wait();
  console.log("✅ Roles assigned.");

  console.log("\n================================");
  console.log("Veilr Address:", veilrAddress);
  console.log("Deployer:     ", deployer.address);
  console.log("Network:       Ethereum Sepolia Testnet (chainId 11155111)");
  console.log("================================");
  console.log("\nNext steps:");
  console.log("1. Copy the contract address above into your frontend config.");
  console.log("2. Use the @zama-fhe/relayer-sdk with SepoliaConfig to interact with encrypted data.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
