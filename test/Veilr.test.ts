import { expect } from "chai";
import { ethers } from "hardhat";

describe("Veilr Protocol & MockLender Integration", function () {
  let veilr: any;
  let mockLender: any;
  let owner: any;
  let borrower: any;

  beforeEach(async function () {
    [owner, borrower] = await ethers.getSigners();

    // 1. Deploy Veilr (The Privacy Infrastructure)
    const Veilr = await ethers.getContractFactory("Veilr");
    veilr = await Veilr.deploy();
    await veilr.waitForDeployment();

    // 2. Deploy MockLender (The Third-Party Protocol)
    const MockLender = await ethers.getContractFactory("MockLender");
    mockLender = await MockLender.deploy(await veilr.getAddress());
    await mockLender.waitForDeployment();
  });

  it("Should successfully link MockLender to the Veilr Infrastructure", async function () {
    expect(await mockLender.veilrCredit()).to.equal(await veilr.getAddress());
  });

  it("Should demonstrate the full private reputation integration flow", async function () {
    const borrowerAddress = borrower.address;

    // Step 1: Initial check should fail (no score yet)
    await expect(mockLender.checkBorrowerEligibility(borrowerAddress))
      .to.be.revertedWith("Borrower has no credit score on Veilr");

    // Step 2: Borrower generates their private credit score on Veilr
    // This performs FHE computations on-chain to determine tier
    await veilr.connect(borrower).applyForCredit();
    
    // Step 3: Verify the infrastructure confirms score existence
    expect(await veilr.hasCreditScore(borrowerAddress)).to.be.true;

    // Step 4: MockLender performs the integration call
    // This triggers requestCreditTier() which grants MockLender access to the encrypted handle
    const tx = await mockLender.checkBorrowerEligibility(borrowerAddress);
    
    // Step 5: Assert integration success via events and state
    await expect(tx).to.emit(mockLender, "EligibilityChecked");
    
    expect(await mockLender.hasBeenChecked(borrowerAddress)).to.be.true;
    
    console.log("      ✅ Logic Flow Verified: Reputation generated and verified privately.");
  });
});
