import { useEffect, useState } from 'react';
import { useFhevm } from '../hooks/useFhevm';
import { useContract } from '../hooks/useContract';
import { TransactionHistory } from '../components/TransactionHistory';
import { Shield, RefreshCw, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAddress, isAddress } from 'ethers';

export const Dashboard = () => {
    const { account, instance, provider, rawProvider } = useFhevm();
    const { getContract, CONTRACT_ADDRESS } = useContract();
    
    const [balance, setBalance] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [depositStatus, setDepositStatus] = useState<string>('');
    const [selectedCurrency, setSelectedCurrency] = useState<string>('cUSDT');
    const [authData, setAuthData] = useState<{ keypair: any, signer: string, startTimestamp: number, durationDays: number } | null>(null);

    const currencies = [
        { symbol: 'cUSDT', label: 'US Dollar', flag: '🇺🇸' },
        { symbol: 'cNGN', label: 'Nigerian Naira', flag: '🇳🇬' },
        { symbol: 'cKES', label: 'Kenyan Shilling', flag: '🇰🇪' },
        { symbol: 'cGHS', label: 'Ghanaian Cedi', flag: '🇬🇭' }
    ];

    // Persist authData to sessionStorage to survive reloads, keyed by contract address
    useEffect(() => {
        if (authData && account && CONTRACT_ADDRESS) {
            const sessionKey = `veilr_auth_${account.toLowerCase()}_${CONTRACT_ADDRESS.toLowerCase()}`;
            sessionStorage.setItem(sessionKey, JSON.stringify(authData));
        }
    }, [authData, account, CONTRACT_ADDRESS]);

    // Load authData specifically for the current contract address
    useEffect(() => {
        if (account && CONTRACT_ADDRESS) {
            const sessionKey = `veilr_auth_${account.toLowerCase()}_${CONTRACT_ADDRESS.toLowerCase()}`;
            const stored = sessionStorage.getItem(sessionKey);
            if (stored) {
                try {
                    setAuthData(JSON.parse(stored));
                    console.log("Restored authorization for current contract deployment");
                } catch (e) {
                    console.error("Failed to parse stored auth:", e);
                }
            } else {
                // If no auth for this specific contract, reset local state
                setAuthData(null);
            }
        }
    }, [account, CONTRACT_ADDRESS]);

    const handleAuthorize = async () => {
        if (!account || !instance) return;
        setLoading(true);
        try {
            const keypair = instance.generateKeypair();
            // CRITICAL: startTimestamp must be in the past (not future) to pass SDK validation.
            // We store this exact value and reuse it verbatim in userDecrypt — any mismatch
            // causes the Relayer to reject the signature with a 500 error.
            const startTimestamp = Math.floor(Date.now() / 1000) - 3600;
            const durationDays = 1;

            const eip712 = instance.createEIP712(
                keypair.publicKey,
                [getAddress(CONTRACT_ADDRESS)],
                startTimestamp,
                durationDays
            );
            
            const signer = await (rawProvider || (window as any).ethereum).request({
                method: 'eth_signTypedData_v4',
                params: [account, JSON.stringify(eip712, (key, value) => 
                    typeof value === 'bigint' ? value.toString() : value
                )],
            });

            // Store ALL values that were signed — they must be replayed identically to the Relayer
            const newAuth = { keypair, signer, startTimestamp, durationDays };
            setAuthData(newAuth);
            setLoading(false);
            return newAuth;
        } catch (error) {
            console.error("Authorization failed:", error);
            setLoading(false);
            return null;
        }
    };

    const fetchBalance = async (bypassAuthCheck = false) => {
        if (!account || !instance) return;
        setLoading(true);
        try {
            console.log(`Checking balance handle for ${selectedCurrency}...`);
            const contract = await getContract(true);
            const encryptedBalanceHandle = await contract.getBalance(selectedCurrency);

            console.log("Received balance handle raw:", encryptedBalanceHandle);
            
            // Normalize handle to a proper 32-byte (64-char) hex string
            let handleHex = "0x";
            try {
                if (encryptedBalanceHandle) {
                    // Force hex conversion and pad to exactly 64 characters (32 bytes)
                    let hexVal = BigInt(encryptedBalanceHandle).toString(16);
                    handleHex = "0x" + hexVal.padStart(64, '0');
                }
            } catch (e) {
                console.warn("Could not convert handle to hex:", e);
                handleHex = "0x";
            }

            console.log("Normalized handle hex:", handleHex, "Length:", handleHex.length);

            // A valid FHEVM handle MUST be a 32-byte hex string (0x + 64 characters)
            const isInvalidHandle = !encryptedBalanceHandle || 
                                   handleHex === "0x" || 
                                   handleHex.length < 66 ||
                                   handleHex === "0x0000000000000000000000000000000000000000000000000000000000000000";

            if (isInvalidHandle) {
                console.log(`Handle "${handleHex}" is invalid or empty. Defaulting to 0.`);
                setBalance('0');
                setLoading(false);
                return true;
            }

            // Reuse authData if we have it
            if (!authData && !bypassAuthCheck) {
                console.log("No authorization found. Waiting for user to authorize.");
                setBalance(null);
                setLoading(false);
                return false;
            }

            // Use cached or fresh auth
            const activeKeypair = authData?.keypair;
            const activeSigner = authData?.signer;

            if (!activeKeypair || !activeSigner) {
                 setLoading(false);
                 return false;
            }

            console.log("Decrypting handle using cached credentials...");
            console.log(`Handle: ${handleHex}`);
            console.log(`Contract: ${getAddress(CONTRACT_ADDRESS)}`);
            console.log(`User: ${getAddress(account)}`);
            console.log(`startTimestamp: ${authData.startTimestamp}, durationDays: ${authData.durationDays}`);

            // CRITICAL: startTimestamp and durationDays MUST exactly match the values
            // used when createEIP712 was called and signed by the wallet.
            // Any difference causes the Relayer to fail signature verification → 500.
            const decryptResult = await instance.userDecrypt(
                [{ handle: handleHex, contractAddress: getAddress(CONTRACT_ADDRESS) }],
                activeKeypair.privateKey,
                activeKeypair.publicKey,
                activeSigner,
                [getAddress(CONTRACT_ADDRESS)],
                getAddress(account),
                authData.startTimestamp,  // Exact value that was signed
                authData.durationDays     // Exact value that was signed
            );
            // userDecrypt returns an OBJECT keyed by handle hex, e.g.:
            //   { "0xabc...def": BigInt(1000) }
            // NOT an array. We extract the value using the handle we passed in.
            console.log("Raw decryptResult:", decryptResult);

            const values = Object.values(decryptResult);
            if (values.length > 0) {
                const rawValue = values[0];
                const newBalance = rawValue.toString();
                console.log("Decrypted balance:", newBalance);
                setBalance(newBalance);
                setLoading(false);
                return true;
            } else {
                console.warn("Gateway returned empty decryption result.");
                setBalance('0');
            }
        } catch (error: any) {
            const errStr = String(error?.message || error);
            // 503 = ciphertext not yet synced to Gateway — this is expected after a mint.
            // Return 'pending' so the caller knows to wait and retry, not to show an error.
            if (errStr.includes('503') || errStr.includes('not ready') || errStr.includes('Ciphertext')) {
                console.log('Gateway sync pending — coprocessor still relaying. Will retry...');
                setLoading(false);
                return 'pending';
            }
            console.error('Balance fetch err:', error);
            if (errStr.includes('Handle')) {
                setBalance('0');
            }
        }
        setLoading(false);
        return false;
    };

    useEffect(() => {
        if (account && instance) {
            fetchBalance();
        }
    }, [account, instance, selectedCurrency, authData]); // authData included to re-fetch when authorized

    const handleMint = async () => {
        if (!account || !instance) {
            alert("Please connect your wallet and wait for initialization!");
            return;
        }
        console.log(`Minting 1000 ${selectedCurrency}`);
        try {
            setLoading(true);
            setDepositStatus(`Minting ${selectedCurrency}...`);
            const contract = await getContract(true);
            
            const tx = await contract.mint(selectedCurrency, 1000);
            
            setDepositStatus('Awaiting On-chain Confirmation...');
            await tx.wait();

            // The Zama coprocessor needs time to relay the FHE computation from Sepolia
            // to the Gateway chain before the Relayer can decrypt it.
            // Typical sync time: 30–90s on testnet. We wait 30s then poll every 15s.
            const INITIAL_WAIT_MS = 30_000;
            const POLL_INTERVAL_MS = 15_000;
            const MAX_POLLS = 12; // 30s + 12×15s = ~3 minutes total

            setDepositStatus('Waiting for Gateway sync (30s)...');
            await new Promise(r => setTimeout(r, INITIAL_WAIT_MS));

            let decrypted = false;
            for (let i = 0; i < MAX_POLLS; i++) {
                const attempt = i + 1;
                setDepositStatus(`Syncing Gateway... attempt ${attempt}/${MAX_POLLS}`);
                console.log(`Polling attempt ${attempt}/${MAX_POLLS}...`);

                const result = await fetchBalance();
                if (result === true) {
                    // fetchBalance set the balance state directly — we're done
                    decrypted = true;
                    break;
                }
                // result === 'pending' (503) or false — wait and retry
                if (i < MAX_POLLS - 1) {
                    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
                }
            }

            if (!decrypted) {
                console.warn('Balance did not sync within timeout. Try refreshing manually.');
                setDepositStatus('Sync timeout — click Refresh to retry');
                setTimeout(() => setDepositStatus(''), 5000);
            } else {
                setDepositStatus('');
            }
        } catch (error) {
            console.error("Mint error:", error);
            setDepositStatus('');
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Currency Selector */}
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {currencies.map((c) => (
                    <button
                        key={c.symbol}
                        type="button"
                        onClick={() => setSelectedCurrency(c.symbol)}
                        className={`flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all whitespace-nowrap ${
                            selectedCurrency === c.symbol 
                            ? "bg-primary/10 border-primary text-white shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]" 
                            : "bg-surface border-white/5 text-text-muted hover:border-white/10"
                        }`}
                    >
                        <span className="text-xl">{c.flag}</span>
                        <div className="text-left">
                            <p className="text-xs font-medium uppercase tracking-wider">{c.symbol}</p>
                            <p className="text-sm opacity-60">{c.label}</p>
                        </div>
                    </button>
                ))}
            </div>

            <div className="bg-gradient-to-br from-primary/20 to-surface border border-primary/20 rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-20">
                    <Shield size={120} />
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-semibold text-white tracking-tight">
                            {!account ? '---' : loading ? '...' : (authData ? (balance || '***') : balance === '0' ? '0' : 'Confidential')}
                        </span>
                        <span className="text-xl text-text-muted">{selectedCurrency}</span>
                    </div>
                    {account && !loading && authData && (
                        <button 
                            type="button"
                            onClick={() => fetchBalance()}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-muted hover:text-white"
                            title="Refresh Balance"
                        >
                            <RefreshCw size={20} />
                        </button>
                    )}
                    {account && !authData && (
                        <button 
                            type="button"
                            onClick={handleAuthorize}
                            className="px-4 py-2 bg-primary/20 text-primary border border-primary/30 text-sm font-medium rounded-lg hover:bg-primary/30 transition-colors"
                        >
                            Authorize to View
                        </button>
                    )}
                </div>
                {account && (
                    <p className="mt-4 text-sm text-primary flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className={`${loading ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full bg-primary opacity-75`}></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        {loading ? 'Decrypting via KMS...' : 'Decrypted securely on client'}
                    </p>
                )}

                <div className="mt-8 flex gap-4">
                    <Link to="/send" className="inline-block px-6 py-3 bg-white text-background font-medium rounded-xl hover:bg-white/90 transition-colors">
                        Send Assets
                    </Link>
                    <button 
                        type="button"
                        onClick={handleMint} 
                        disabled={loading || !!depositStatus}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary/20 text-primary border border-primary/30 font-medium rounded-xl hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {(loading || !!depositStatus) && <Loader2 size={18} className="animate-spin" />}
                        {depositStatus || `Mint Mock ${selectedCurrency}`}
                    </button>
                </div>
            </div>

            <TransactionHistory />
        </div>
    );
};
