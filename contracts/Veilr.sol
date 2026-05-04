// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import {FHE, euint8, euint64, eaddress, ebool, externalEuint8, externalEuint64, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./IVeilrCredit.sol";

contract Veilr is ZamaEthereumConfig, AccessControl, IVeilrCredit {
    bytes32 public constant SENDER_ROLE = keccak256("SENDER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant REGULATOR_ROLE = keccak256("REGULATOR_ROLE");

    // Mapping: symbol hash => user address => encrypted balance
    mapping(bytes32 => mapping(address => euint64)) internal balances;
    
    // Mapping: symbol hash => encrypted total supply
    mapping(bytes32 => euint64) public totalSupply;

    // Maintain a list of all users to allow encrypted transfers without revealing the recipient
    address[] public allUsers;
    mapping(address => bool) public userExists;

    mapping(address => uint256) public nextTxNonce;
    mapping(address => uint256) public joinDate;
    mapping(address => uint256) public totalDeposited; // Lifetime volume in plaintext for stats
    
    function _recordInteraction(address user) internal {
        if (joinDate[user] == 0) {
            joinDate[user] = block.timestamp;
        }
        nextTxNonce[user]++;
    }

    struct DecryptionRequest {
        bool active;
        bytes32 symbolHash;
        euint64 encryptedAmount;
        address sender;
        uint256 signaturesCount;
        bool approved; 
    }

    mapping(uint256 => DecryptionRequest) public decryptionRequests;
    mapping(uint256 => mapping(address => bool)) public hasSigned;

    event Deposit(address indexed user, string symbol);
    event TransferInitiated(uint256 indexed nonce, string symbol, uint256 timestamp);
    event ComplianceDecryptionApproved(uint256 indexed nonce, address indexed approver);
    event DecryptionReady(uint256 indexed nonce);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    modifier onlyCompliance() {
        require(hasRole(COMPLIANCE_ROLE, msg.sender), "Not a compliance officer");
        _;
    }

    function _getSymbolHash(string memory symbol) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(symbol));
    }

    /// @notice Mock minting for testing purposes. Converts plaintext to encrypted balance on-chain.
    /// @param symbol The token symbol (e.g., "cUSDT", "cNGN")
    /// @param amount Plaintext amount to mint
    function mint(string calldata symbol, uint64 amount) public {
        _recordInteraction(msg.sender);
        bytes32 sHash = _getSymbolHash(symbol);
        euint64 eAmount = FHE.asEuint64(amount);

        if (!userExists[msg.sender]) {
            userExists[msg.sender] = true;
            allUsers.push(msg.sender);
            balances[sHash][msg.sender] = FHE.asEuint64(0);
        }

        balances[sHash][msg.sender] = FHE.add(balances[sHash][msg.sender], eAmount);
        totalSupply[sHash] = FHE.add(totalSupply[sHash], eAmount);
        totalDeposited[msg.sender] += uint256(amount);

        FHE.allowThis(balances[sHash][msg.sender]);
        FHE.allow(balances[sHash][msg.sender], msg.sender);
        FHE.allowThis(totalSupply[sHash]);

        emit Deposit(msg.sender, symbol);
    }

    /// @notice Deposit encrypted funds. Amount must be encrypted client-side using the Relayer SDK.
    /// @param symbol The token symbol
    /// @param amount The external encrypted uint64 handle
    /// @param inputProof The zero-knowledge input proof
    function deposit(string calldata symbol, externalEuint64 amount, bytes calldata inputProof) public {
        _recordInteraction(msg.sender);
        bytes32 sHash = _getSymbolHash(symbol);
        euint64 amountVerified = FHE.fromExternal(amount, inputProof);

        if (!userExists[msg.sender]) {
            userExists[msg.sender] = true;
            allUsers.push(msg.sender);
            balances[sHash][msg.sender] = FHE.asEuint64(0);
        }

        balances[sHash][msg.sender] = FHE.add(balances[sHash][msg.sender], amountVerified);
        totalSupply[sHash] = FHE.add(totalSupply[sHash], amountVerified);

        FHE.allowThis(balances[sHash][msg.sender]);
        FHE.allow(balances[sHash][msg.sender], msg.sender);
        FHE.allowThis(totalSupply[sHash]);

        emit Deposit(msg.sender, symbol);
    }

    /// @notice Send an encrypted amount to an encrypted recipient.
    /// @param symbol The token symbol
    /// @param encryptedRecipient The external encrypted recipient address handle
    /// @param encryptedAmount The external encrypted uint64 amount handle
    /// @param inputProof The zero-knowledge input proof covering both encrypted inputs
    function send(
        string calldata symbol,
        externalEaddress encryptedRecipient,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) public {
        _recordInteraction(msg.sender);
        bytes32 sHash = _getSymbolHash(symbol);
        eaddress recipient = FHE.fromExternal(encryptedRecipient, inputProof);
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        FHE.allowTransient(recipient, address(this));
        FHE.allowTransient(amount, address(this));

        ebool canTransfer = FHE.le(amount, balances[sHash][msg.sender]);
        euint64 actualTransferAmount = FHE.select(canTransfer, amount, FHE.asEuint64(0));

        balances[sHash][msg.sender] = FHE.sub(balances[sHash][msg.sender], actualTransferAmount);
        FHE.allowThis(balances[sHash][msg.sender]);
        FHE.allow(balances[sHash][msg.sender], msg.sender);

        for (uint i = 0; i < allUsers.length; i++) {
            address user = allUsers[i];
            
            if (FHE.isInitialized(balances[sHash][user]) == false) {
                balances[sHash][user] = FHE.asEuint64(0);
            }

            ebool isRecipient = FHE.eq(recipient, user);
            euint64 amountToAdd = FHE.select(isRecipient, actualTransferAmount, FHE.asEuint64(0));
            balances[sHash][user] = FHE.add(balances[sHash][user], amountToAdd);
            
            FHE.allowThis(balances[sHash][user]);
            FHE.allow(balances[sHash][user], user);
        }

        uint256 nonce = nextTxNonce[msg.sender] - 1; 

        decryptionRequests[nonce] = DecryptionRequest({
            active: true,
            symbolHash: sHash,
            encryptedAmount: actualTransferAmount,
            sender: msg.sender,
            signaturesCount: 0,
            approved: false
        });

        FHE.allowThis(actualTransferAmount);
        FHE.allow(actualTransferAmount, msg.sender);

        emit TransferInitiated(nonce, symbol, block.timestamp);
    }

    function signDecryptionRequest(uint256 nonce) public onlyCompliance {
        require(decryptionRequests[nonce].active, "Request not active");
        require(!hasSigned[nonce][msg.sender], "Already signed");
        require(!decryptionRequests[nonce].approved, "Already approved");

        hasSigned[nonce][msg.sender] = true;
        decryptionRequests[nonce].signaturesCount++;

        emit ComplianceDecryptionApproved(nonce, msg.sender);

        if (decryptionRequests[nonce].signaturesCount >= 2) {
            decryptionRequests[nonce].approved = true;
            emit DecryptionReady(nonce);
        }
    }

    function getEncryptedAmountForRegulator(uint256 nonce) public view returns (euint64) {
        require(hasRole(REGULATOR_ROLE, msg.sender), "Only regulator can view");
        require(decryptionRequests[nonce].approved, "Decryption not approved");
        return decryptionRequests[nonce].encryptedAmount;
    }

    function getBalance(string calldata symbol) public view returns (euint64) {
        return balances[_getSymbolHash(symbol)][msg.sender];
    }

    function getBalanceFor(address user, string calldata symbol) public view returns (euint64) {
        return balances[_getSymbolHash(symbol)][user];
    }

    // --- Private Credit Scoring Module ---

    struct CreditApplication {
        euint8  encryptedTier;
        bool    scored;
        address applicant;
        uint256 timestamp;
    }

    mapping(uint256 => CreditApplication) public applications;
    mapping(address => uint256[]) public applicantHistory;
    uint256 public applicationCount;

    event CreditApplicationSubmitted(uint256 indexed appId, address indexed applicant, uint256 timestamp);
    event ScoreTierGranted(uint256 indexed appId, address indexed lender);

    function hasCreditScore(address borrower) external view override returns (bool) {
        return applicantHistory[borrower].length > 0;
    }

    function requestCreditTier(address borrower, address lender) external override returns (euint8) {
        require(applicantHistory[borrower].length > 0, "No credit score found");
        uint256 latestAppId = applicantHistory[borrower][applicantHistory[borrower].length - 1];
        euint8 tier = applications[latestAppId].encryptedTier;
        FHE.allow(tier, lender);
        return tier;
    }

    function applyForCredit() public {
        _recordInteraction(msg.sender);

        // 1. Calculate Activity (Nonce)
        uint64 rawActivity = uint64(nextTxNonce[msg.sender]);
        euint64 vActivity = FHE.asEuint64(rawActivity);
        
        // 2. Calculate Age (Days)
        uint256 ageSecs = block.timestamp - joinDate[msg.sender];
        uint256 ageDays = ageSecs / 1 days;

        // 3. Check Multi-Token Balances
        string[4] memory symbols = ["cUSDT", "cNGN", "cKES", "cGHS"];
        euint8 count1000 = FHE.asEuint8(0);
        euint8 count500 = FHE.asEuint8(0);

        for (uint i = 0; i < symbols.length; i++) {
            bytes32 sHash = _getSymbolHash(symbols[i]);
            euint64 bal = balances[sHash][msg.sender];
            
            if (FHE.isInitialized(bal)) {
                count1000 = FHE.add(count1000, FHE.select(FHE.ge(bal, uint64(1000)), FHE.asEuint8(1), FHE.asEuint8(0)));
                count500 = FHE.add(count500, FHE.select(FHE.ge(bal, uint64(500)), FHE.asEuint8(1), FHE.asEuint8(0)));
            }
        }

        // 4. Compute Strict Tiers
        // Tier 1: (count1000 >= 3) && (tx >= 10) && (age >= 5 days)
        ebool isTier1 = FHE.and(
            FHE.and(FHE.ge(count1000, uint8(3)), FHE.ge(vActivity, uint64(10))),
            FHE.asEbool(ageDays >= 5)
        );

        // Tier 2: (count500 >= 2) && (tx >= 5) && (age >= 3 days)
        ebool isTier2 = FHE.and(
            FHE.and(FHE.ge(count500, uint8(2)), FHE.ge(vActivity, uint64(5))),
            FHE.asEbool(ageDays >= 3)
        );

        // Tier 3: tx >= 1
        ebool isTier3 = FHE.ge(vActivity, uint64(1));

        euint8 tier = FHE.select(isTier1, FHE.asEuint8(1),
                      FHE.select(isTier2, FHE.asEuint8(2),
                      FHE.select(isTier3, FHE.asEuint8(3), FHE.asEuint8(3))));

        uint256 appId = applicationCount++;
        applications[appId] = CreditApplication({
            encryptedTier: tier,
            scored: true,
            applicant: msg.sender,
            timestamp: block.timestamp
        });

        applicantHistory[msg.sender].push(appId);
        
        FHE.allow(tier, msg.sender);
        FHE.allow(tier, address(this));
        
        emit CreditApplicationSubmitted(appId, msg.sender, block.timestamp);
    }

    function getScoreTier(uint256 appId) public returns (euint8) {
        require(applications[appId].scored, "Not scored yet");
        
        euint8 tier = applications[appId].encryptedTier;
        FHE.allow(tier, msg.sender); 

        emit ScoreTierGranted(appId, msg.sender);
        return tier;
    }
}
