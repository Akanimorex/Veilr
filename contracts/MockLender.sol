// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IVeilrCredit.sol";
import "@fhevm/solidity/lib/FHE.sol";

contract MockLender {
    IVeilrCredit public veilrCredit;

    uint256 public constant TIER1_LIMIT = 10000;
    uint256 public constant TIER2_LIMIT = 5000;
    uint256 public constant TIER3_LIMIT = 0;

    mapping(address => bool) public eligibilityChecked;
    mapping(address => uint256) public timestamp;

    event EligibilityChecked(address indexed borrower, address indexed lender, uint256 time);

    constructor(address _veilrCredit) {
        veilrCredit = IVeilrCredit(_veilrCredit);
    }

    function checkBorrowerEligibility(address borrower) external {
        require(veilrCredit.hasCreditScore(borrower), "Borrower has no credit score on Veilr");
        // Request encrypted tier — this is the one-line integration
        veilrCredit.requestCreditTier(borrower, address(this));
        // Store that eligibility was checked (not the tier itself — stays encrypted)
        eligibilityChecked[borrower] = true;
        timestamp[borrower] = block.timestamp;
        emit EligibilityChecked(borrower, msg.sender, block.timestamp);
    }

    function hasBeenChecked(address borrower) external view returns (bool) {
        return eligibilityChecked[borrower];
    }
}
