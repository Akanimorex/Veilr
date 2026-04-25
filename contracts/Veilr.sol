// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import {FHE, euint8, euint64, eaddress, ebool, externalEuint8, externalEuint64, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract Veilr is ZamaEthereumConfig, AccessControl {
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

    uint256 public nextTxNonce;

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

    function _getSymbolHash(string calldata symbol) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(symbol));
    }

    /// @notice Mock minting for testing purposes. Converts plaintext to encrypted balance on-chain.
    /// @param symbol The token symbol (e.g., "cUSDT", "cNGN")
    /// @param amount Plaintext amount to mint
    function mint(string calldata symbol, uint64 amount) public {
        bytes32 sHash = _getSymbolHash(symbol);
        euint64 eAmount = FHE.asEuint64(amount);

        if (!userExists[msg.sender]) {
            userExists[msg.sender] = true;
            allUsers.push(msg.sender);
            // Initialize with encrypted zero to avoid adding to a null handle
            balances[sHash][msg.sender] = FHE.asEuint64(0);
        }

        balances[sHash][msg.sender] = FHE.add(balances[sHash][msg.sender], eAmount);
        totalSupply[sHash] = FHE.add(totalSupply[sHash], eAmount);

        // Grant permissions for the new handles
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
        bytes32 sHash = _getSymbolHash(symbol);
        eaddress recipient = FHE.fromExternal(encryptedRecipient, inputProof);
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // Allow contract to use the inputs
        FHE.allowTransient(recipient, address(this));
        FHE.allowTransient(amount, address(this));

        // Validate sender has sufficient balance
        ebool canTransfer = FHE.le(amount, balances[sHash][msg.sender]);
        euint64 actualTransferAmount = FHE.select(canTransfer, amount, FHE.asEuint64(0));

        // Deduct from sender
        balances[sHash][msg.sender] = FHE.sub(balances[sHash][msg.sender], actualTransferAmount);
        FHE.allowThis(balances[sHash][msg.sender]);
        FHE.allow(balances[sHash][msg.sender], msg.sender);

        // Add to recipient homomorphically
        for (uint i = 0; i < allUsers.length; i++) {
            address user = allUsers[i];
            
            // Ensure the user's balance handle is initialized even if they never received this token
            // This is safer than adding to a potentially null handle (0)
            if (FHE.isInitialized(balances[sHash][user]) == false) {
                balances[sHash][user] = FHE.asEuint64(0);
            }

            ebool isRecipient = FHE.eq(recipient, user);
            euint64 amountToAdd = FHE.select(isRecipient, actualTransferAmount, FHE.asEuint64(0));
            balances[sHash][user] = FHE.add(balances[sHash][user], amountToAdd);
            
            FHE.allowThis(balances[sHash][user]);
            FHE.allow(balances[sHash][user], user);
        }

        uint256 nonce = nextTxNonce++;

        // Save for compliance review
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

    /// @notice Threshold compliance decryption — requires two compliance officers to sign.
    ///         Once both sign, an event is emitted for off-chain decryption via the Zama Gateway.
    /// @param nonce The transaction nonce to sign for decryption
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

    /// @notice Returns the encrypted handle for a compliance-approved transaction amount.
    ///         Regulators can use this handle with the Zama Relayer SDK to request decryption off-chain.
    /// @param nonce The transaction nonce
    /// @return The encrypted amount handle
    function getEncryptedAmountForRegulator(uint256 nonce) public view returns (euint64) {
        require(hasRole(REGULATOR_ROLE, msg.sender), "Only regulator can view");
        require(decryptionRequests[nonce].approved, "Decryption not approved");
        return decryptionRequests[nonce].encryptedAmount;
    }

    /// @notice Returns the caller's encrypted balance handle for a specific token.
    /// @param symbol The token symbol
    function getBalance(string calldata symbol) public view returns (euint64) {
        return balances[_getSymbolHash(symbol)][msg.sender];
    }

    // --- Private Credit Scoring Module ---

    struct CreditApplication {
        euint64 encryptedAvgBalance;
        euint64 encryptedTxCount;
        euint64 encryptedWalletAge;
        euint8  encryptedRepaymentFlag;
        euint64 encryptedScore;
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

    function applyForCredit(
        externalEuint64 avgBalance,
        externalEuint64 txCount,
        externalEuint64 walletAge,
        externalEuint8 repaymentFlag,
        bytes calldata inputProof
    ) public {
        euint64 eAvgBalance = FHE.fromExternal(avgBalance, inputProof);
        euint64 eTxCount = FHE.fromExternal(txCount, inputProof);
        euint64 eWalletAge = FHE.fromExternal(walletAge, inputProof);
        euint8 eRepaymentFlag = FHE.fromExternal(repaymentFlag, inputProof);

        FHE.allowTransient(eAvgBalance, address(this));
        FHE.allowTransient(eTxCount, address(this));
        FHE.allowTransient(eWalletAge, address(this));
        FHE.allowTransient(eRepaymentFlag, address(this));

        uint256 appId = applicationCount++;
        applications[appId] = CreditApplication({
            encryptedAvgBalance: eAvgBalance,
            encryptedTxCount: eTxCount,
            encryptedWalletAge: eWalletAge,
            encryptedRepaymentFlag: eRepaymentFlag,
            encryptedScore: FHE.asEuint64(0),
            encryptedTier: FHE.asEuint8(0),
            scored: false,
            applicant: msg.sender,
            timestamp: block.timestamp
        });

        applicantHistory[msg.sender].push(appId);
        
        _computeScore(appId);
        
        emit CreditApplicationSubmitted(appId, msg.sender, block.timestamp);
    }

    function _computeScore(uint256 appId) internal {
        CreditApplication storage app = applications[appId];
        
        // score = (avgBalance × 3) + (txCount × 2) + (walletAge × 2) + (repaymentFlag × 3)
        euint64 part1 = FHE.mul(app.encryptedAvgBalance, uint64(3));
        euint64 part2 = FHE.mul(app.encryptedTxCount, uint64(2));
        euint64 part3 = FHE.mul(app.encryptedWalletAge, uint64(2));
        euint64 part4 = FHE.mul(FHE.asEuint64(app.encryptedRepaymentFlag), uint64(3));

        euint64 totalScore = FHE.add(FHE.add(part1, part2), FHE.add(part3, part4));
        
        // Pre-calculate Tier
        euint8 tier3 = FHE.asEuint8(3);
        euint8 tier2 = FHE.asEuint8(2);
        euint8 tier1 = FHE.asEuint8(1);

        euint8 tier = FHE.select(
            FHE.le(totalScore, uint64(15)),
            tier3,
            FHE.select(
                FHE.le(totalScore, uint64(25)),
                tier2,
                tier1
            )
        );

        app.encryptedScore = totalScore;
        app.encryptedTier = tier;
        app.scored = true;

        FHE.allow(totalScore, app.applicant);
        FHE.allow(tier, app.applicant);
        FHE.allow(totalScore, address(this));
        FHE.allow(tier, address(this));
    }

    function getScoreTier(uint256 appId) public returns (euint8) {
        require(applications[appId].scored, "Not scored yet");
        
        euint8 tier = applications[appId].encryptedTier;
        FHE.allow(tier, msg.sender); // Allow the lender calling this function

        emit ScoreTierGranted(appId, msg.sender);
        return tier;
    }
}
