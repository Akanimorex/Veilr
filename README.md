<div align="center">
  <img src="assets/logo.png" width="120" height="120" alt="Veilr Logo" />
  <h1>Veilr</h1>
  <p><b>The Private Reputation Layer for Decentralized Finance</b></p>
  
  [![Network: Sepolia](https://img.shields.io/badge/Network-Sepolia_Testnet-blueviolet?style=flat-square)](https://sepolia.etherscan.io/)
  [![Privacy: FHE](https://img.shields.io/badge/Privacy-FHE-blue?style=flat-square)](https://zama.ai/fhevm)
  [![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
</div>

---

## Project Overview

**Veilr** is a privacy-first credit infrastructure built on Zama's FHEVM. It solves the "Radical Transparency" problem in Web3 by allowing users to prove their creditworthiness without ever exposing their transaction history, balances, or financial behavior to the public.

By leveraging Fully Homomorphic Encryption (FHE), Veilr enables **Private Credit Scoring**—a "Black Box" evaluation where sensitive financial signals are processed entirely in ciphertext. The result is a verifiable reputation tier that lenders can trust, while the borrower's privacy remains absolute.

### Core Features

1.  **🏆 Private Credit Scoring (Main Feature)**: Generate a verifiable financial tier (1, 2, or 3) based on encrypted wallet signals (age, transaction frequency, liquidity). The underlying data never leaves its encrypted state.
2.  **🛡️ Encrypted Remittance**: A secure transfer protocol where transaction amounts and recipient identities are hidden behind FHE ciphertexts, preventing "rich-list" tracking and front-running.
3.  **⚖️ Threshold Compliance**: A multi-sig governance layer that allows authorized compliance officers to collectively decrypt specific transaction details for AML/KYC requirements, balancing privacy with accountability.

## Architecture: How FHE is Used

Veilr natively uses Fully Homomorphic Encryption so that smart contracts can compute over encrypted data without ever decrypting it.

### 1. Private Credit Scoring (The "Black Box")
Developers can integrate Veilr's credit scoring into their own lending protocols. The math happens inside a "locked box":
-   **Encrypted Evaluation**: The contract takes private signals (transaction count, wallet age, multi-token balances) and performs a weighted evaluation entirely in ciphertext using `FHE.add` and `FHE.select`.
-   **Tier Result Only**: Instead of returning a raw score, the API returns an **encrypted tier**. Lenders only see what they need to know—the borrower's reliability—while the borrower's wealth remains private.
-   **Security**: Using `FHE.allow()`, only the requesting lender (and the applicant) can hold permissions to decrypt the tier result.

### 2. Encrypted Remittance (Stealth Transfers)
-   **Anonymity via Homomorphic Selection**: To prevent leaking the recipient's identity through state changes, the transfer loops over registered users and securely evaluates recipient matching homomorphically.
-   **Zero Transaction Trail**: The public blockchain only sees that a generic transaction occurred. The amounts and destination are hidden behind FHE ciphertexts.

## Technical Stack

-   **FHE VM**: Zama FHEVM (Sepolia Testnet)
-   **Chain ID**: 11155111
-   **Encryption**: TFHE (Threshold Fully Homomorphic Encryption)
-   **Frontend**: React (Vite) + @zama-fhe/relayer-sdk
-   **Smart Contracts**: Solidity (0.8.27) with `fhevm/solidity`

## Getting Started

### 1. Install Dependencies
```bash
npm install
cd frontend && npm install
```

### 2. Deploy to Sepolia
```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

### 3. Run Frontend
```bash
cd frontend && npm run dev
```

## Deployed Contract

-   **Network:** Ethereum Sepolia Testnet
-   **Chain ID:** 11155111
-   **Contract Address:** `0xd667A750C3dba0436eBd47dC5a57B6D7BA49045e`

---
**Veilr: Building the private reputation layer of the internet.**

