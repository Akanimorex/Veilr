// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint8} from "@fhevm/solidity/lib/FHE.sol";

interface IVeilrCredit {
    function hasCreditScore(address borrower) external view returns (bool);
    function requestCreditTier(address borrower, address lender) external returns (euint8);
}
