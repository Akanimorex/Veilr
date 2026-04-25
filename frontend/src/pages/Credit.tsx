import { useState, useEffect } from 'react';
import { useFhevm } from '../hooks/useFhevm';
import { useContract } from '../hooks/useContract';
import { getAddress } from 'ethers';
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
    const { account, instance, rawProvider } = useFhevm();
    const { getContract, CONTRACT_ADDRESS } = useContract();

    // Form State
    const [avgBalance, setAvgBalance] = useState(3); // 1-5
    const [txCount, setTxCount] = useState(2); // 1-3
    const [walletAge, setWalletAge] = useState(24); // 1-60
    const [repaymentHistory, setRepaymentHistory] = useState(1); // 0-1

    // UI State
    const [status, setStatus] = useState<'' | 'Encrypting' | 'Signing' | 'Computing' | 'Complete'>('');
    const [decryptedTier, setDecryptedTier] = useState<number | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [authData, setAuthData] = useState<any>(null);

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
            const durationDays = 1;
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
        if (!instance || !account) return;

        try {
            setStatus('Encrypting');
            const contractFixed = getAddress(CONTRACT_ADDRESS);
            const accountFixed = getAddress(account);

            const input = instance.createEncryptedInput(contractFixed, accountFixed);
            input.add64(avgBalance);
            input.add64(txCount);
            input.add64(walletAge);
            input.add8(repaymentHistory);

            const { handles, inputProof } = await input.encrypt();

            setStatus('Signing');
            const contract = await getContract(true);
            const tx = await contract.applyForCredit(
                handles[0], handles[1], handles[2], handles[3], inputProof
            );
            
            setStatus('Computing');
            await tx.wait();

            // Fetch the new result
            await fetchHistory();
            setStatus('Complete');
            
            // Decrypt the result if authorized
            let activeAuth = authData;
            if (!activeAuth) {
                activeAuth = await handleAuthorize();
            }

            if (activeAuth) {
                // Get the app ID we just created (latest from history)
                const latestApp = await contract.applicationCount() - 1n;
                const appData = await contract.applications(latestApp);
                
                console.log("Decrypting stored tier handle:", appData.encryptedTier);

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
            }

        } catch (e) {
            console.error("Application error", e);
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
                        Prove your creditworthiness. <br/>
                        <span className="text-primary">Reveal nothing.</span>
                    </h1>
                    <p className="text-text-muted text-lg leading-relaxed mb-10">
                        All financial inputs are encrypted inside your browser before they ever reach the blockchain. 
                        Lenders only receive a verified score tier — never your raw data or transaction history.
                    </p>

                    {/* Flow Diagram */}
                    <div className="flex items-center justify-between gap-4 p-6 bg-background/40 backdrop-blur-sm rounded-2xl border border-white/5">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white"><Activity size={18}/></div>
                            <span className="text-[10px] text-text-muted font-medium text-center">Your inputs</span>
                        </div>
                        <ArrowRight size={14} className="text-white/20" />
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary"><Lock size={18}/></div>
                            <span className="text-[10px] text-text-muted font-medium text-center">Encrypted in browser</span>
                        </div>
                        <ArrowRight size={14} className="text-white/20" />
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white"><Zap size={18}/></div>
                            <span className="text-[10px] text-text-muted font-medium text-center">FHE computed on-chain</span>
                        </div>
                        <ArrowRight size={14} className="text-white/20" />
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400"><CheckCircle2 size={18}/></div>
                            <span className="text-[10px] text-text-muted font-medium text-center">Tier result only</span>
                        </div>
                    </div>
                </div>
                
                {/* Abstract visual decor */}
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Section 2: Application Form */}
                <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleSubmit} className="bg-surface border border-white/5 rounded-3xl p-8 space-y-8">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-white">Application Details</h2>
                            <div className="flex items-center gap-2 text-text-muted">
                                <Info size={16} />
                                <span className="text-xs">End-to-end Encrypted</span>
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* Average Balance */}
                            <div className="space-y-4">
                                <label className="text-sm font-medium text-text-muted uppercase tracking-wider">Average Balance Tier</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {['Low', 'Mid', 'High', 'V.High', 'Excel.'].map((label, i) => (
                                        <button
                                            key={label}
                                            type="button"
                                            onClick={() => setAvgBalance(i + 1)}
                                            className={`py-3 rounded-xl text-xs font-bold transition-all border ${
                                                avgBalance === i + 1 
                                                ? 'bg-primary border-primary text-white' 
                                                : 'bg-background border-white/5 text-text-muted hover:border-white/10'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tx Activity */}
                            <div className="space-y-4">
                                <label className="text-sm font-medium text-text-muted uppercase tracking-wider">Transaction Activity</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Low', 'Medium', 'High'].map((label, i) => (
                                        <button
                                            key={label}
                                            type="button"
                                            onClick={() => setTxCount(i + 1)}
                                            className={`py-3 rounded-xl text-xs font-bold transition-all border ${
                                                txCount === i + 1 
                                                ? 'bg-primary border-primary text-white' 
                                                : 'bg-background border-white/5 text-text-muted hover:border-white/10'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Wallet Age */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium text-text-muted uppercase tracking-wider">Wallet Age</label>
                                    <span className="text-primary font-bold text-sm bg-primary/10 px-3 py-1 rounded-full">{walletAge} months</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="60" 
                                    value={walletAge}
                                    onChange={(e) => setWalletAge(parseInt(e.target.value))}
                                    className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary border border-white/5"
                                />
                                <div className="flex justify-between text-[10px] text-text-muted font-bold">
                                    <span>1 MONTH</span>
                                    <span>60 MONTHS</span>
                                </div>
                            </div>

                            {/* Repayment History */}
                            <div className="flex items-center justify-between p-4 bg-background/50 rounded-2xl border border-white/5">
                                <div>
                                    <label className="block text-sm font-medium text-white">Good Repayment History</label>
                                    <p className="text-xs text-text-muted">Do you have a history of on-time loan repayments?</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setRepaymentHistory(repaymentHistory === 1 ? 0 : 1)}
                                    className={`relative w-14 h-7 rounded-full transition-colors ${repaymentHistory === 1 ? 'bg-primary' : 'bg-white/10'}`}
                                >
                                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${repaymentHistory === 1 ? 'left-8' : 'left-1'}`} />
                                </button>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={!account || !!status}
                                className={`w-full py-5 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
                                    !account ? 'bg-primary/50 cursor-not-allowed' :
                                    status ? 'bg-primary/80 animate-pulse' : 'bg-primary hover:bg-primary-hover active:scale-[0.98] shadow-lg shadow-primary/20'
                                }`}
                            >
                                {status === 'Encrypting' && <Loader2 className="animate-spin" size={20} />}
                                {status === 'Signing' && <Loader2 className="animate-spin" size={20} />}
                                {status === 'Computing' && <Loader2 className="animate-spin" size={20} />}
                                {status === 'Complete' && <CheckCircle2 size={20} />}
                                
                                {status === 'Encrypting' ? 'Encrypting Inputs...' :
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
                                            <h3 className="text-green-400 font-bold text-lg">Tier 1 — Full Credit</h3>
                                            <p className="text-xs text-green-400/70 mt-1">You qualify for the maximum loan amount.</p>
                                        </div>
                                    </div>
                                )}
                                {decryptedTier === 2 && (
                                    <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center space-y-4">
                                        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 mx-auto">
                                            <Activity size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-amber-400 font-bold text-lg">Tier 2 — Partial Credit</h3>
                                            <p className="text-xs text-amber-400/70 mt-1">You qualify for a reduced loan amount.</p>
                                        </div>
                                    </div>
                                )}
                                {decryptedTier === 3 && (
                                    <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center space-y-4">
                                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-400 mx-auto">
                                            <AlertCircle size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-red-400 font-bold text-lg">Tier 3 — Not Eligible</h3>
                                            <p className="text-xs text-red-400/70 mt-1">Your current signals do not meet the minimum threshold.</p>
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
