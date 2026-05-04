import { useEffect, useState } from 'react';
import { useFhevm } from '../hooks/useFhevm';
import { useContract } from '../hooks/useContract';
import { TransactionHistory } from '../components/TransactionHistory';
import { Shield, RefreshCw, Loader2, BadgeCheck, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAddress } from 'ethers';

export const Dashboard = () => {
    const { account, instance, provider, rawProvider, isInitializing } = useFhevm();
    const { getContract, CONTRACT_ADDRESS } = useContract();
    
    const [balance, setBalance] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [depositStatus, setDepositStatus] = useState<string>('');
    const [selectedCurrency, setSelectedCurrency] = useState<string>('cUSDT');
    const [authData, setAuthData] = useState<{ keypair: any, signer: string, startTimestamp: number, durationDays: number } | null>(null);
    const [creditAppCount, setCreditAppCount] = useState<number>(0);

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
            const durationDays = 7;

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

    const fetchBalances = async () => {
        if (!account || !instance) return;
        setLoading(true);
        try {
            const contract = await getContract(true);
            const isAuthValid = (auth: any) => {
                if (!auth) return false;
                const now = Math.floor(Date.now() / 1000);
                const expiry = auth.startTimestamp + (auth.durationDays * 86400);
                return now < expiry;
            };

            let activeAuth = authData;
            if (!isAuthValid(activeAuth)) {
                setBalance(null);
                setPoolBalance(null);
                setLoading(false);
                return;
            }

            // 1. Fetch Wallet Balance
            try {
                const walletHandle = await contract.getBalanceFor(getAddress(account), selectedCurrency);
                if (walletHandle > 0n) {
                    const decryptResult = await instance.userDecrypt(
                        [{ handle: "0x" + BigInt(walletHandle).toString(16).padStart(64, '0'), contractAddress: getAddress(CONTRACT_ADDRESS) }],
                        activeAuth.keypair.privateKey,
                        activeAuth.keypair.publicKey,
                        activeAuth.signer,
                        [getAddress(CONTRACT_ADDRESS)],
                        getAddress(account),
                        activeAuth.startTimestamp,
                        activeAuth.durationDays
                    ).catch((e: any) => {
                        if (String(e?.message).includes('500') || String(e?.message).includes('reverted')) return null;
                        throw e;
                    });

                    if (decryptResult) {
                        setBalance(Number(Object.values(decryptResult)[0]).toFixed(2));
                    }
                } else {
                    setBalance('0.00');
                }
            } catch (e) {
                console.warn("Wallet balance decrypt failed:", e);
                setBalance('Syncing...');
            }

            // 2. Fetch Pool Balance
            try {
                const poolHandle = await contract.getPoolBalanceFor(getAddress(account), selectedCurrency);
                if (poolHandle > 0n) {
                    const decryptResult = await instance.userDecrypt(
                        [{ handle: "0x" + BigInt(poolHandle).toString(16).padStart(64, '0'), contractAddress: getAddress(CONTRACT_ADDRESS) }],
                        activeAuth.keypair.privateKey,
                        activeAuth.keypair.publicKey,
                        activeAuth.signer,
                        [getAddress(CONTRACT_ADDRESS)],
                        getAddress(account),
                        activeAuth.startTimestamp,
                        activeAuth.durationDays
                    ).catch((e: any) => {
                        if (String(e?.message).includes('500') || String(e?.message).includes('reverted')) return null;
                        throw e;
                    });

                    if (decryptResult) {
                        setPoolBalance(Number(Object.values(decryptResult)[0]).toFixed(2));
                    }
                } else {
                    setPoolBalance('0.00');
                }
            } catch (e) {
                console.warn("Pool balance decrypt failed:", e);
                setPoolBalance('Syncing...');
            }
        } catch (error: any) {
            const errStr = String(error?.message || error);
            if (errStr.includes('503') || errStr.includes('not ready') || errStr.includes('Ciphertext') || errStr.includes('500')) {
                console.log('Gateway sync pending...');
            } else {
                console.error("Failed to fetch balances:", error);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        if (account && instance) {
            fetchBalances();
        }
    }, [account, instance, selectedCurrency, authData]);

    // Fetch credit application count for the stat card
    useEffect(() => {
        const fetchCreditCount = async () => {
            if (!account) return;
            try {
                const contract = await getContract();
                const filter = contract.filters.CreditApplicationSubmitted(null, account);
                const events = await contract.queryFilter(filter, -10000);
                setCreditAppCount(events.length);
            } catch (e) {
                // Silently fail — credit history is optional context
            }
        };
        fetchCreditCount();
    }, [account]);

    const handleMint = async () => {
        if (!account) {
            alert("Please connect your wallet first!");
            return;
        }
        if (isInitializing || !instance) {
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

            for (let i = 0; i < MAX_POLLS; i++) {
                const attempt = i + 1;
                setDepositStatus(`Syncing Gateway... attempt ${attempt}/${MAX_POLLS}`);
                
                await fetchBalances();
                
                // If balance is now set, we assume sync is done
                if (balance !== '0.00' && balance !== null) {
                    setDepositStatus('');
                    break;
                }

                if (i < MAX_POLLS - 1) {
                    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
                }
            }
            setDepositStatus('');
        } catch (error) {
            console.error("Mint error:", error);
            setDepositStatus('');
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {!account ? (
                <div className="relative overflow-hidden bg-surface border border-white/5 rounded-[2.5rem] p-12 text-center space-y-6">
                    <div className="h-20 w-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mx-auto mb-4">
                        <Shield size={40} />
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight">Connect Your Wallet</h1>
                    <p className="text-text-muted max-w-md mx-auto text-lg">
                        Veilr uses FHE to keep your finances private. Connect your wallet to access your encrypted vault.
                    </p>
                </div>
            ) : (
                <>
                    {/* Hero Section */}
                    <div className="relative overflow-hidden bg-surface border border-white/5 rounded-[2.5rem] p-10">
                        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
                        
                        <div className="relative z-10 flex flex-col md:flex-row gap-10 items-start justify-between">
                            <div className="space-y-6 max-w-xl">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-primary uppercase tracking-widest">
                                    <Shield size={14} /> Encrypted Wallet Active
                                </div>
                                
                                <div className="space-y-2">
                                    <h1 className="text-5xl font-bold text-white tracking-tight">
                                        Your Private <span className="text-primary italic font-serif">Vault.</span>
                                    </h1>
                                    <p className="text-text-muted text-lg">
                                        Manage your assets with Zero-Knowledge proofs and FHE.
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <Link to="/credit" className="px-6 py-3 bg-white text-background font-bold rounded-xl hover:bg-white/90 transition-all flex items-center gap-2">
                                        <BadgeCheck size={18} />
                                        Private Credit
                                    </Link>
                                    <Link to="/send" className="px-6 py-3 bg-primary/20 text-primary border border-primary/30 font-bold rounded-xl hover:bg-primary/30 transition-all flex items-center gap-2">
                                        <ArrowUpRight size={18} />
                                        Send
                                    </Link>
                                </div>
                            </div>

                            <div className="w-full md:w-[320px] space-y-4">
                                <div className="bg-background/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
                                    <div className="absolute -top-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Shield size={150} />
                                    </div>
                                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4">Current Balance</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-bold text-white tracking-tighter">
                                            {loading ? '...' : (authData ? (balance || '0.00') : 'Locked')}
                                        </span>
                                        <span className="text-sm font-medium text-text-muted">{selectedCurrency}</span>
                                        {loading && <RefreshCw size={16} className="animate-spin text-primary" />}
                                    </div>
                                    
                                    {!authData ? (
                                        <button 
                                            onClick={handleAuthorize}
                                            className="mt-6 w-full py-2 bg-primary/20 text-primary text-[10px] font-bold uppercase rounded-lg border border-primary/20 hover:bg-primary/30 transition-all"
                                        >
                                            Unlock Vault
                                        </button>
                                    ) : (
                                        <div className="mt-6 flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                            <span className="text-[10px] text-white font-bold uppercase">Decrypted</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    {currencies.map(c => (
                                        <button
                                            key={c.symbol}
                                            onClick={() => setSelectedCurrency(c.symbol)}
                                            className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${
                                                selectedCurrency === c.symbol ? 'bg-primary text-white' : 'bg-white/5 text-text-muted hover:bg-white/10'
                                            }`}
                                        >
                                            {c.symbol}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-surface border border-white/5 rounded-3xl p-6 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Credit Score</p>
                                <p className="text-2xl font-bold text-white">{creditAppCount > 0 ? 'Verified' : 'Unranked'}</p>
                            </div>
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                <BadgeCheck size={20} />
                            </div>
                        </div>

                        <div className="bg-surface border border-white/5 rounded-3xl p-6 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Network Status</p>
                                <p className="text-2xl font-bold text-white">Sepolia</p>
                            </div>
                            <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
                                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                            </div>
                        </div>

                        <button
                            onClick={handleMint}
                            disabled={loading || !!depositStatus}
                            className="bg-surface border border-white/5 rounded-3xl p-6 flex items-center justify-between hover:border-primary/30 transition-all text-left"
                        >
                            <div>
                                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Faucet</p>
                                <p className="text-lg font-bold text-white truncate max-w-[120px]">
                                    {depositStatus || `Mint 1000 ${selectedCurrency}`}
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-text-muted">
                                {loading ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                            </div>
                        </button>
                    </div>

                    <TransactionHistory />
                </>
            )}
        </div>
    );
};
