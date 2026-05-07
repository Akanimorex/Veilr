import { ethers } from "hardhat";

async function main() {
  const VEILR_ADDRESS = "0xd667A750C3dba0436eBd47dC5a57B6D7BA49045e";
  // Change this to the address you want to grant roles to
  const TARGET_ADDRESS = "YOUR_WALLET_ADDRESS_HERE"; 

  if (TARGET_ADDRESS === "YOUR_WALLET_ADDRESS_HERE") {
    console.error("Please replace YOUR_WALLET_ADDRESS_HERE with your actual wallet address!");
    process.exit(1);
  }

  console.log(`Granting roles to ${TARGET_ADDRESS} on contract ${VEILR_ADDRESS}...`);

  const [deployer] = await ethers.getSigners();
  const veilr = await ethers.getContractAt("Veilr", VEILR_ADDRESS);

  const COMPLIANCE_ROLE = await veilr.COMPLIANCE_ROLE();
  const REGULATOR_ROLE = await veilr.REGULATOR_ROLE();

  console.log("Granting COMPLIANCE_ROLE...");
  const tx1 = await veilr.grantRole(COMPLIANCE_ROLE, TARGET_ADDRESS);
  await tx1.wait();
  console.log("✅ COMPLIANCE_ROLE granted.");

  console.log("Granting REGULATOR_ROLE...");
  const tx2 = await veilr.grantRole(REGULATOR_ROLE, TARGET_ADDRESS);
  await tx2.wait();
  console.log("✅ REGULATOR_ROLE granted.");

  console.log("\nSuccess! You can now access the Compliance and Regulator features in the dApp.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
