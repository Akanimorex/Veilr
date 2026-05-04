import { useState, useEffect } from 'react';
import { useFhevm } from '../hooks/useFhevm';
import { useContract } from '../hooks/useContract';
import { getAddress } from 'ethers';
import { toast } from 'react-hot-toast';
import { 
    ShieldCheck, 
    ArrowRight, 
    ChevronRight, 
    Info, 
    CheckCircle2, 
    AlertCircle, 
    Clock, 
    History,
    Activity,
    Lock,
    Zap,
    Loader2
} from 'lucide-react';

export const Credit = () => {
    const { account, instance, rawProvider, isInitializing } = useFhevm();
    const { getContract, CONTRACT_ADDRESS } = useContract();

    // Verified Stats (Fetched from Chain)
    const [verifiedStats, setVerifiedStats] = useState({
        balance: '...',
        activity: '...',
        age: '...'
    });

    // UI State
    const [status, setStatus] = useState<'' | 'Signing' | 'Computing' | 'Complete'>('');
    const [decryptedTier, setDecryptedTier] = useState<number | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [authData, setAuthData] = useState<any>(null);

    const fetchVerifiedStats = async () => {
        if (!account) return;
        try {
            const contract = await getContract();
            
            // 1. Get User-specific Nonce (Activity)
            const nonce = await contract.nextTxNonce(account);
            
            // 2. Get Join Date (Age)
            const jd = await contract.joinDate(account);
            let ageStr = "First Visit";
            if (jd > 0n) {
                const diff = Math.floor(Date.now() / 1000) - Number(jd);
                const days = Math.floor(diff / 86400);
                ageStr = days > 0 ? `${days} Days` : "Joined Today";
            }

            setVerifiedStats({
                balance: "Encrypted",
                activity: `${nonce} Txns`,
                age: ageStr
            });
        } catch (e) {
            console.error("Failed to fetch verified stats", e);
        }
    };

    useEffect(() => {
        if (account) fetchVerifiedStats();
    }, [account]);

    // Load auth from session
    useEffect(() => {
        if (account && CONTRACT_ADDRESS) {
            const sessionKey = `veilr_auth_${account.toLowerCase()}_${CONTRACT_ADDRESS.toLowerCase()}`;
            const stored = sessionStorage.getItem(sessionKey);
            if (stored) setAuthData(JSON.parse(stored));
        }
    }, [account, CONTRACT_ADDRESS]);

    const handleAuthorize = async () => {
        if (!account || !instance) return;
        try {
            const keypair = instance.generateKeypair();
            const startTimestamp = Math.floor(Date.now() / 1000) - 3600;
            const durationDays = 7; 
            const eip712 = instance.createEIP712(keypair.publicKey, [getAddress(CONTRACT_ADDRESS)], startTimestamp, durationDays);
            const signer = await (rawProvider || (window as any).ethereum).request({
                method: 'eth_signTypedData_v4',
                params: [account, JSON.stringify(eip712, (k, v) => typeof v === 'bigint' ? v.toString() : v)],
            });
            const newAuth = { keypair, signer, startTimestamp, durationDays };
            setAuthData(newAuth);
            const sessionKey = `veilr_auth_${account.toLowerCase()}_${CONTRACT_ADDRESS.toLowerCase()}`;
            sessionStorage.setItem(sessionKey, JSON.stringify(newAuth));
            return newAuth;
        } catch (e) {
            console.error("Auth failed", e);
            return null;
        }
    };

    const isAuthValid = (auth: any) => {
        if (!auth) return false;
        const now = Math.floor(Date.now() / 1000);
        const expiry = auth.startTimestamp + (auth.durationDays * 86400);
        return now < expiry;
    };

    const fetchHistory = async () => {
        if (!account) return;
        setLoadingHistory(true);
        try {
            const contract = await getContract();
            const filter = contract.filters.CreditApplicationSubmitted(null, account);
            const events = await contract.queryFilter(filter, -10000);
            
            const apps = [];
            for (const event of events) {
                const appId = Number((event as any).args.appId);
                const timestamp = Number((event as any).args.timestamp);
                const appData = await contract.applications(appId);
                apps.push({
                    id: appId,
                    date: new Date(timestamp * 1000).toLocaleDateString(),
                    scored: appData.scored,
                    status: appData.scored ? 'Processed' : 'Pending'
                });
            }
            setHistory(apps.sort((a, b) => b.id - a.id));
        } catch (e) {
            console.error("History fetch error", e);
        }
        setLoadingHistory(false);
    };

    useEffect(() => {
        if (account) fetchHistory();
    }, [account]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!instance || !account) {
            toast.error("Please connect your wallet first!");
            return;
        }

        const loadingToast = toast.loading("Initiating Private Credit Application...");
        
        try {
            setStatus('Signing');
            const contractFixed = getAddress(CONTRACT_ADDRESS);
            const accountFixed = getAddress(account);

            const contract = await getContract(true);
            const tx = await contract.applyForCredit();
            
            toast.loading('Computing Reputation Tier via FHE...', { id: loadingToast });
            setStatus('Computing');
            await tx.wait();

            // Fetch the new result
            await fetchHistory();
            setStatus('Complete');
            toast.success('Reputation Verification Submitted!', { id: loadingToast });
            
            // Decrypt the result if authorized
            let activeAuth = authData;
            if (!isAuthValid(activeAuth)) {
                toast.loading('Authorizing to decrypt result...', { id: loadingToast });
                activeAuth = await handleAuthorize();
            }

            if (activeAuth) {
                toast.loading('Decrypting Verification Tier...', { id: loadingToast });
                // Get the app ID we just created (latest from history)
                const latestApp = await contract.applicationCount() - 1n;
                const appData = await contract.applications(latestApp);
                
                const decryptResult = await instance.userDecrypt(
                    [{ 
                        handle: "0x" + BigInt(appData.encryptedTier).toString(16).padStart(64, '0'), 
                        contractAddress: contractFixed 
                    }],
                    activeAuth.keypair.privateKey,
                    activeAuth.keypair.publicKey,
                    activeAuth.signer,
                    [contractFixed],
                    accountFixed,
                    activeAuth.startTimestamp,
                    activeAuth.durationDays
                );
                
                const val = Number(Object.values(decryptResult)[0]);
                setDecryptedTier(val);
                toast.success('Reputation Verified!', { id: loadingToast });
            }
        } catch (e: any) {
            console.error("Application error", e);
            toast.error(e?.message || "Application failed", { id: loadingToast });
            setStatus('');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in fade-in duration-700">
            {/* Section 1: Hero Banner */}
            <div className="relative bg-gradient-to-br from-primary/30 via-surface to-surface border border-primary/20 rounded-3xl p-10 overflow-hidden">
                <div className="relative z-10 max-w-2xl">
                    <div className="flex items-center gap-2 text-primary mb-4">
                        <ShieldCheck size={20} />
                        <span className="text-sm font-bold uppercase tracking-widest">Privacy-First Credit</span>
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
                        Strict On-Chain <br/>
                        <span className="text-primary">Verification</span>
                    </h1>
                    <p className="text-text-muted text-lg leading-relaxed mb-6">
                        We've upgraded our metrics. Eligibility is now determined by your multi-asset portfolio and historical engagement.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-primary font-bold text-xs uppercase mb-1">Tier 1 Target</p>
                            <p className="text-white text-xs">3+ tokens (1000+ each) + 10 Txns + 5 Days</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-amber-400 font-bold text-xs uppercase mb-1">Tier 2 Target</p>
                            <p className="text-white text-xs">2+ tokens (500+ each) + 5 Txns + 3 Days</p>
                        </div>
                    </div>
                </div>
                
                {/* Abstract visual decor */}
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Section 2: Application Form */}
                <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleSubmit} className="bg-surface border border-white/5 rounded-3xl p-8 space-y-8">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-white">Application Summary</h2>
                            <div className="flex items-center gap-2 text-text-muted">
                                <Info size={16} />
                                <span className="text-xs">End-to-end Encrypted</span>
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* Multi-Token Balances (Verified) */}
                            <div className="space-y-4">
                                <label className="text-sm font-medium text-text-muted uppercase tracking-wider">Multi-Token Portfolio</label>
                                <div className="p-4 bg-background border border-primary/20 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><ShieldCheck size={16}/></div>
                                        <span className="text-white font-bold">Scanning All Vaults...</span>
                                    </div>
                                    <span className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase tracking-widest">Multi-Asset Scan</span>
                                </div>
                            </div>

                            {/* Tx Activity (Verified) */}
                            <div className="space-y-4">
                                <label className="text-sm font-medium text-text-muted uppercase tracking-wider">Transaction Activity</label>
                                <div className="p-4 bg-background border border-primary/20 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Activity size={16}/></div>
                                        <span className="text-white font-bold">{verifiedStats.activity}</span>
                                    </div>
                                    <span className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase tracking-widest">Real-Time Sync</span>
                                </div>
                            </div>

                            {/* Wallet Age (Verified) */}
                            <div className="space-y-4">
                                <label className="text-sm font-medium text-text-muted uppercase tracking-wider">Active History</label>
                                <div className="p-4 bg-background border border-primary/20 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Clock size={16}/></div>
                                        <span className="text-white font-bold">{verifiedStats.age}</span>
                                    </div>
                                    <span className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase tracking-widest">History Logged</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={!account || !!status || isInitializing || !instance}
                                className={`w-full py-5 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
                                    !account ? 'bg-primary/50 cursor-not-allowed' :
                                    (status || isInitializing) ? 'bg-primary/80 animate-pulse' : 'bg-primary hover:bg-primary-hover active:scale-[0.98] shadow-lg shadow-primary/20'
                                }`}
                            >
                                {(status === 'Encrypting' || status === 'Signing' || status === 'Computing' || isInitializing) && <Loader2 className="animate-spin" size={20} />}
                                {status === 'Complete' && <CheckCircle2 size={20} />}
                                
                                {isInitializing ? 'Initializing FHE...' :
                                 status === 'Encrypting' ? 'Encrypting Inputs...' :
                                 status === 'Signing' ? 'Signing Transaction...' :
                                 status === 'Computing' ? 'On-Chain FHE Computing...' :
                                 status === 'Complete' ? 'Application Submitted' :
                                 'Encrypt & Submit Application'}
                            </button>
                            
                            {status && status !== 'Complete' && (
                                <div className="mt-6 flex justify-between">
                                    {['Encrypting', 'Signing', 'Computing', 'Complete'].map((step, i) => {
                                        const steps = ['Encrypting', 'Signing', 'Computing', 'Complete'];
                                        const currentIdx = steps.indexOf(status);
                                        const isPast = i < currentIdx;
                                        const isCurrent = i === currentIdx;
                                        
                                        return (
                                            <div key={step} className="flex flex-col items-center gap-2 flex-1">
                                                <div className={`h-1 w-full rounded-full transition-colors ${isPast ? 'bg-primary' : isCurrent ? 'bg-primary/30' : 'bg-white/5'}`} />
                                                <span className={`text-[9px] font-bold uppercase tracking-widest ${isCurrent ? 'text-primary' : 'text-text-muted'}`}>{step}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                {/* Section 3: Result Card & History */}
                <div className="space-y-6">
                    {/* Result Card */}
                    <div className="bg-surface border border-white/5 rounded-3xl p-8 space-y-6">
                        <h2 className="text-lg font-semibold text-white">Your Score Tier</h2>
                        
                        {decryptedTier === null ? (
                            <div className="aspect-video bg-background/50 border border-white/5 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-3">
                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-text-muted">
                                    <Lock size={20} />
                                </div>
                                <p className="text-sm text-text-muted">Submit an application to reveal your privacy-preserving credit tier.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in zoom-in-95 duration-500">
                                {decryptedTier === 1 && (
                                    <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-2xl text-center space-y-4">
                                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 mx-auto">
                                            <ShieldCheck size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-green-400 font-bold text-lg">Tier 1 — Elite Reputation</h3>
                                            <p className="text-xs text-green-400/70 mt-1">You are verified as a high-activity, high-liquidity participant. Perfect for VIP access across DeFi protocols.</p>
                                        </div>
                                    </div>
                                )}
                                {decryptedTier === 2 && (
                                    <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center space-y-4">
                                        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 mx-auto">
                                            <Activity size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-amber-400 font-bold text-lg">Tier 2 — Trusted Participant</h3>
                                            <p className="text-xs text-amber-400/70 mt-1">You have established a solid on-chain footprint and maintain a healthy portfolio.</p>
                                        </div>
                                    </div>
                                )}
                                {decryptedTier === 3 && (
                                    <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center space-y-4">
                                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-400 mx-auto">
                                            <AlertCircle size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-red-400 font-bold text-lg">Tier 3 — Emerging Profile</h3>
                                            <p className="text-xs text-red-400/70 mt-1">Your profile is still growing. Increase your transaction activity or portfolio size to reach higher tiers.</p>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="p-4 bg-background/50 rounded-xl border border-white/5 flex gap-3">
                                    <Info size={16} className="text-primary shrink-0" />
                                    <p className="text-[10px] text-text-muted leading-relaxed">
                                        Your raw financial inputs were never visible on-chain. Only this tier was shared with the lender via homomorphic selection.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* History Table */}
                    <div className="bg-surface border border-white/5 rounded-3xl p-8 space-y-6">
                        <div className="flex items-center gap-2">
                            <History size={18} className="text-white" />
                            <h2 className="text-lg font-semibold text-white">Application History</h2>
                        </div>

                        {loadingHistory ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="animate-spin text-primary" size={24} />
                            </div>
                        ) : history.length === 0 ? (
                            <p className="text-sm text-text-muted text-center py-8">No previous applications.</p>
                        ) : (
                            <div className="space-y-4">
                                {history.map(app => (
                                    <div key={app.id} className="flex items-center justify-between p-4 bg-background rounded-2xl border border-white/5">
                                        <div>
                                            <p className="text-xs font-bold text-white">APP #{app.id}</p>
                                            <p className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
                                                <Clock size={10} /> {app.date}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                                                {app.status}
                                            </span>
                                            <ChevronRight size={14} className="text-text-muted" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
