// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import {FHE, euint8} from "@fhevm/solidity/lib/FHE.sol";
import "./IVeilrCredit.sol";

contract VeilrLendingPool is AccessControl {
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    IVeilrCredit public veilrCredit;
    IERC20 public cUSDT;

    struct LoanPosition {
        uint256 principal;           // amount borrowed
        uint256 collateral;          // collateral deposited
        uint256 borrowedAt;          // timestamp
        bool    active;              // is loan currently open
        uint8   tierAtBorrow;        // credit tier when loan was taken
    }

    struct LenderProfile {
        uint256 totalDeposited;      // lifetime deposits
        uint256 totalWithdrawn;      // lifetime withdrawals  
        uint256 activeDeposit;       // current pool contribution
        uint256 joinedAt;            // first deposit timestamp
        bool    verified;            // has passed borrower validation check
    }

    struct BorrowerProfile {
        uint256 totalBorrowed;       // lifetime borrow amount
        uint256 totalRepaid;         // lifetime repaid amount
        uint256 defaultCount;        // number of defaults (collateral liquidated)
        uint256 lastBorrowAt;        // last borrow timestamp
        bool    hasActiveLoan;       // currently has open loan
    }

    mapping(address => uint256) public lenderDeposits;        // lender pool balances
    mapping(address => LoanPosition) public activeLoans;      // borrower active loans
    mapping(address => LenderProfile) public lenderProfiles;  // lender reputation data
    mapping(address => BorrowerProfile) public borrowerProfiles; // borrower history
    
    uint256 public totalPoolLiquidity;
    uint256 public constant TIER1_BORROW_LIMIT = 10000 * 1e18;
    uint256 public constant TIER2_BORROW_LIMIT = 5000 * 1e18;
    uint256 public constant TIER3_BORROW_LIMIT = 0;
    uint256 public constant COLLATERAL_RATIO = 120; // 120% collateral required

    event LenderDeposited(address indexed lender, uint256 amount, uint256 timestamp);
    event LenderWithdrew(address indexed lender, uint256 amount, uint256 timestamp);
    event BorrowerValidated(address indexed lender, address indexed borrower, uint256 timestamp);
    event LenderValidated(address indexed borrower, address indexed lender, uint256 timestamp);
    event LoanIssued(address indexed borrower, uint256 amount, uint256 collateral, uint8 tier, uint256 timestamp);
    event LoanRepaid(address indexed borrower, uint256 amount, uint256 timestamp);
    event CollateralLiquidated(address indexed borrower, uint256 amount, uint256 timestamp);

    constructor(address _veilrCredit, address _cUSDT) {
        veilrCredit = IVeilrCredit(_veilrCredit);
        cUSDT = IERC20(_cUSDT);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function depositToPool(uint256 amount) public {
        require(cUSDT.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        lenderDeposits[msg.sender] += amount;
        totalPoolLiquidity += amount;

        LenderProfile storage profile = lenderProfiles[msg.sender];
        if (profile.joinedAt == 0) {
            profile.joinedAt = block.timestamp;
        }
        profile.totalDeposited += amount;
        profile.activeDeposit += amount;

        emit LenderDeposited(msg.sender, amount, block.timestamp);
    }

    function withdrawFromPool(uint256 amount) public {
        require(lenderDeposits[msg.sender] >= amount, "Insufficient deposit balance");
        require(totalPoolLiquidity >= amount, "Insufficient pool liquidity");

        lenderDeposits[msg.sender] -= amount;
        totalPoolLiquidity -= amount;

        LenderProfile storage profile = lenderProfiles[msg.sender];
        profile.activeDeposit -= amount;
        profile.totalWithdrawn += amount;

        require(cUSDT.transfer(msg.sender, amount), "Transfer to lender failed");
        emit LenderWithdrew(msg.sender, amount, block.timestamp);
    }

    function validateBorrower(address borrower) public returns (euint8) {
        require(veilrCredit.hasCreditScore(borrower), "Borrower has no credit score");
        euint8 tier = veilrCredit.requestCreditTier(borrower, msg.sender);
        emit BorrowerValidated(msg.sender, borrower, block.timestamp);
        return tier;
    }

    function validateLender(address lender) public view returns (
        uint256 totalDeposited,
        uint256 activeDeposit,
        uint256 joinedAt,
        bool verified
    ) {
        LenderProfile memory profile = lenderProfiles[lender];
        return (
            profile.totalDeposited,
            profile.activeDeposit,
            profile.joinedAt,
            profile.verified
        );
    }

    function requestLoan(uint256 amount, uint256 collateralAmount) public {
        require(!borrowerProfiles[msg.sender].hasActiveLoan, "Already has an active loan");
        require(collateralAmount >= (amount * COLLATERAL_RATIO) / 100, "Insufficient collateral ratio");
        require(veilrCredit.hasCreditScore(msg.sender), "Must have credit score");
        require(totalPoolLiquidity >= amount, "Insufficient pool liquidity");

        // Request encrypted tier to grant permission to this contract
        veilrCredit.requestCreditTier(msg.sender, address(this));

        require(cUSDT.transferFrom(msg.sender, address(this), collateralAmount), "Collateral transfer failed");
        require(cUSDT.transfer(msg.sender, amount), "Loan transfer failed");

        activeLoans[msg.sender] = LoanPosition({
            principal: amount,
            collateral: collateralAmount,
            borrowedAt: block.timestamp,
            active: true,
            tierAtBorrow: 0 // Will be 0 until scoring is finalized or simplified for demo
        });

        BorrowerProfile storage profile = borrowerProfiles[msg.sender];
        profile.totalBorrowed += amount;
        profile.lastBorrowAt = block.timestamp;
        profile.hasActiveLoan = true;

        totalPoolLiquidity -= amount;

        emit LoanIssued(msg.sender, amount, collateralAmount, 0, block.timestamp);
    }

    function repayLoan() public {
        LoanPosition storage loan = activeLoans[msg.sender];
        require(loan.active, "No active loan found");

        require(cUSDT.transferFrom(msg.sender, address(this), loan.principal), "Principal repayment failed");
        require(cUSDT.transfer(msg.sender, loan.collateral), "Collateral return failed");

        BorrowerProfile storage profile = borrowerProfiles[msg.sender];
        profile.totalRepaid += loan.principal;
        profile.hasActiveLoan = false;

        totalPoolLiquidity += loan.principal;
        loan.active = false;

        emit LoanRepaid(msg.sender, loan.principal, block.timestamp);
    }

    function liquidateCollateral(address borrower) public {
        require(hasRole(COMPLIANCE_ROLE, msg.sender), "Only compliance role can liquidate");
        LoanPosition storage loan = activeLoans[borrower];
        require(loan.active, "No active loan to liquidate");

        totalPoolLiquidity += loan.collateral;
        
        BorrowerProfile storage profile = borrowerProfiles[borrower];
        profile.defaultCount++;
        profile.hasActiveLoan = false;
        
        loan.active = false;

        emit CollateralLiquidated(borrower, loan.collateral, block.timestamp);
    }
}
