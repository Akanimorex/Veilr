import { useFhevm } from './useFhevm';
import { Contract } from 'ethers';

const VeilrABI = [
  "function COMPLIANCE_ROLE() public view returns (bytes32)",
  "function hasRole(bytes32 role, address account) public view returns (bool)",
  "function mint(string symbol, uint64 amount) public",
  "function deposit(string symbol, bytes32 amount, bytes inputProof) public",
  "function send(string symbol, bytes32 encryptedRecipient, bytes32 encryptedAmount, bytes inputProof) public",
  "function signDecryptionRequest(uint256 nonce) public",
  "function getBalance(string symbol) public view returns (uint256)",
  "function nextTxNonce(address user) public view returns (uint256)",
  "function decryptionRequests(uint256 nonce) public view returns (bool active, bytes32 symbolHash, uint256 encryptedAmount, address sender, uint256 signaturesCount, bool approved)",
  "function joinDate(address user) public view returns (uint256)",
  "function hasSigned(uint256 nonce, address account) public view returns (bool)",
  "function getBalanceFor(address user, string symbol) view returns (uint256)",
  "function totalDeposited(address user) view returns (uint256)",
  "function applicationCount() view returns (uint256)",
  "function applyForCredit() public",
  "function applications(uint256 appId) public view returns (uint256 encryptedTier, bool scored, address applicant, uint256 timestamp)",
  "function applicantHistory(address applicant, uint256 index) public view returns (uint256)",
  "function getScoreTier(uint256 appId) public returns (uint256)",
  "event CreditApplicationSubmitted(uint256 indexed appId, address indexed applicant, uint256 timestamp)",
  "event ScoreTierGranted(uint256 indexed appId, address indexed lender)",
  "event Deposit(address indexed user, string symbol)",
  "event TransferInitiated(uint256 indexed nonce, string symbol, uint256 timestamp)",
  "event ComplianceDecryptionApproved(uint256 indexed nonce, address indexed approver)",
  "event DecryptionReady(uint256 indexed nonce)"
];

const CONTRACT_ADDRESS = "0xd667A750C3dba0436eBd47dC5a57B6D7BA49045e";

export const useContract = () => {
    const { provider } = useFhevm();

    const getContract = async (withSigner = false) => {
        if (!provider) throw new Error("No provider available");
        if (withSigner) {
            const signer = await provider.getSigner();
            return new Contract(CONTRACT_ADDRESS, VeilrABI, signer);
        }
        return new Contract(CONTRACT_ADDRESS, VeilrABI, provider);
    };

    return { getContract, CONTRACT_ADDRESS };
};
