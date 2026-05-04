# Veilr - Private Financial Infrastructure (FHE)

**A Fully Homomorphic Encryption (FHE) protocol providing private credit scoring, encrypted remittance, and threshold compliance for the next generation of DeFi.**

## Project Overview

In today's Web3 landscape, every financial signal is public. Wallet balances, transaction amounts, and creditworthiness are permanently visible on-chain. This "radical transparency" is a major barrier to institutional and mass-market adoption. No one wants their entire salary, savings habits, or financial reputation exposed to the public.

**Veilr** is a privacy-preserving infrastructure layer built on the Zama FHEVM. It provides a three-pillar solution for financial sovereignty:
1.  **Private Credit Scoring**: An API-first module that allows users to generate a verifiable financial reputation (Tier 1, 2, or 3) based on their private wallet history, without revealing their raw balances or activity.
2.  **Encrypted Remittance**: A secure transfer protocol where amounts and recipient identities remain completely encrypted on-chain.
3.  **Threshold Compliance**: A multi-sig auditing layer that allows regulators to decrypt specific transactions only when authorized by multiple independent compliance officers.

## Architecture: How FHE is Used

Veilr natively uses Fully Homomorphic Encryption so that smart contracts can compute over encrypted data without ever decrypting it.

### 1. Private Credit Scoring (The "Black Box" API)
Developers can integrate Veilr's credit scoring into their own lending protocols. The math happens inside a "locked box":
-   **Encrypted Evaluation**: The contract takes private signals (transaction count, wallet age, multi-token balances) and performs a weighted evaluation entirely in ciphertext using `FHE.add` and `FHE.select`.
-   **Tier Result Only**: Instead of returning a raw score, the API returns an **encrypted tier** (1, 2, or 3). Lenders only see what they need to know—the borrower's reliability—while the borrower's wealth remains private.
-   **Security**: Using `FHE.allow()`, only the requesting lender (and the applicant) can hold permissions to decrypt the tier result.

### 2. Encrypted Remittance (The Stealth Send)
-   **Anonymity via Homomorphic Selection**: To prevent leaking the recipient's identity through state changes, the transfer loops over an array of registered users and securely evaluates recipient matching homomorphically.
-   **Zero Transaction Trail**: The public blockchain only sees that a generic transaction occurred. The amounts and destination are hidden behind FHE ciphertexts.

### 3. Threshold Compliance (The Auditing Layer)
Privacy is a right, but accountability is a necessity for regulated markets.
-   **Multi-Sig Decryption**: If a transaction is flagged for AML/KYC review, `COMPLIANCE_ROLE` members must co-sign a decryption request.
-   **Regulatory Access**: Only after a 2-of-2 (or M-of-N) approval does the contract grant `REGULATOR_ROLE` the permission to decrypt the specific transaction amount through the Zama Gateway.

## Technical Stack
-   **FHE VM**: Zama Protocol (Sepolia Testnet)
-   **Encryption**: TFHE (Threshold Fully Homomorphic Encryption)
-   **Frontend**: React + @fhevm/sdk
-   **Smart Contracts**: Solidity (0.8.24) with `fhevm/solidity`

## Getting Started

### 1. Install Dependencies
```bash
npm install
cd frontend && npm install
```

### 2. Deploy to Zama Sepolia
```bash
npx hardhat run scripts/deploy.ts --network zama
```

### 3. Integration for Developers
Lending protocols can integrate the Veilr API using the `IVeilrCredit.sol` interface:
```solidity
import "./IVeilrCredit.sol";

function validateUser(address user) external {
    euint8 tier = IVeilrCredit(veilrAddress).requestCreditTier(user, address(this));
    // Decrypt tier off-chain via Relayer SDK to make lending decision
}
```

## Deployed Contract
-   **Network:** Zama Protocol Sepolia Testnet (Chain ID 9000)
-   **Contract Address:** `0xd667A750C3dba0436eBd47dC5a57B6D7BA49045e`

---
**Veilr: Building the private reputation layer of the internet.**
