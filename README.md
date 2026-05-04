<div align="center">
  <img src="assets/logo.png" width="120" height="120" alt="Veilr Logo" />
  <h1>Veilr</h1>
  <p><b>Private Financial Infrastructure powered by Fully Homomorphic Encryption (FHE)</b></p>
  
  [![Network: Sepolia](https://img.shields.io/badge/Network-Sepolia_Testnet-blueviolet?style=flat-square)](https://sepolia.etherscan.io/)
  [![Privacy: FHE](https://img.shields.io/badge/Privacy-FHE-blue?style=flat-square)](https://zama.ai/fhevm)
  [![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
</div>

---

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

## Modern UX & UI

Veilr has been redesigned with a premium, monochromatic design language inspired by modern infrastructure tools.

-   **Monochromatic Aesthetic**: A clean, near-black interface with refined violet accents and high-fidelity typography (Inter).
-   **Reactive Feedback**: Integrated `react-hot-toast` for real-time transaction lifecycle tracking—from client-side encryption to on-chain confirmation.
-   **Immediate Responsiveness**: Submission buttons provide zero-latency visual cues, ensuring users are never left guessing during heavy FHE computations.
-   **Smart Wallet Management**: Automated network enforcement for Sepolia Testnet and secure session-clearing on disconnect.

## Technical Stack

-   **FHE VM**: Zama Protocol (Sepolia Testnet)
-   **Encryption**: TFHE (Threshold Fully Homomorphic Encryption)
-   **Frontend**: React (Vite) + @fhevm/sdk
-   **UI/UX**: TailwindCSS + Lucide Icons + React Hot Toast
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

### 3. Run Frontend
```bash
cd frontend && npm run dev
```

## Deployed Contract

-   **Network:** Zama Protocol Sepolia Testnet (Chain ID 9000)
-   **Contract Address:** `0xd667A750C3dba0436eBd47dC5a57B6D7BA49045e`

---
**Veilr: Building the private reputation layer of the internet.**
