import { useState, useEffect } from 'react';
import { useFhevm } from '../hooks/useFhevm';
import { useContract } from '../hooks/useContract';
import { getAddress } from 'ethers';
import { toast } from 'react-hot-toast';
import { Loader2, ChevronRight, Clock, Lock } from 'lucide-react';

export const Credit = () => {
    const { account, instance, rawProvider, isInitializing } = useFhevm();
    const { getContract, CONTRACT_ADDRESS } = useContract();

    const [verifiedStats, setVerifiedStats] = useState({ activity: '...', age: '...' });
    const [status, setStatus] = useState<'' | 'Signing' | 'Computing' | 'Complete'>('');
    const [decryptedTier, setDecryptedTier] = useState<number | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [authData, setAuthData] = useState<any>(null);

    const fetchVerifiedStats = async () => {
        if (!account) return;
        try {
            const contract = await getContract();
            const nonce = await contract.nextTxNonce(account);
            const jd = await contract.joinDate(account);
            let ageStr = "First visit";
            if (jd > 0n) {
                const diff = Math.floor(Date.now() / 1000) - Number(jd);
                const days = Math.floor(diff / 86400);
                ageStr = days > 0 ? `${days}d` : "Today";
            }
            setVerifiedStats({ activity: `${nonce}`, age: ageStr });
        } catch (e) {
            console.error("Failed to fetch verified stats", e);
        }
    };

    useEffect(() => { if (account) fetchVerifiedStats(); }, [account]);

    useEffect(() => {
        if (account && CONTRACT_ADDRESS) {
            const key = `veilr_auth_${account.toLowerCase()}_${CONTRACT_ADDRESS.toLowerCase()}`;
            const stored = sessionStorage.getItem(key);
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
            const key = `veilr_auth_${account.toLowerCase()}_${CONTRACT_ADDRESS.toLowerCase()}`;
            sessionStorage.setItem(key, JSON.stringify(newAuth));
            return newAuth;
        } catch (e) {
            console.error("Auth failed", e);
            return null;
        }
    };

    const isAuthValid = (auth: any) => {
        if (!auth) return false;
        const now = Math.floor(Date.now() / 1000);
        return now < auth.startTimestamp + (auth.durationDays * 86400);
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
                apps.push({ id: appId, date: new Date(timestamp * 1000).toLocaleDateString(), scored: appData.scored, status: appData.scored ? 'Processed' : 'Pending' });
            }
            setHistory(apps.sort((a, b) => b.id - a.id));
        } catch (e) { console.error("History fetch error", e); }
        setLoadingHistory(false);
    };

    useEffect(() => { if (account) fetchHistory(); }, [account]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!instance || !account) { toast.error("Please connect your wallet first!"); return; }

        const loadingToast = toast.loading("Initiating credit application...");
        try {
            setStatus('Signing');
            const contractFixed = getAddress(CONTRACT_ADDRESS);
            const accountFixed = getAddress(account);
            const contract = await getContract(true);
            const tx = await contract.applyForCredit();

            toast.loading('Computing reputation tier via FHE...', { id: loadingToast });
            setStatus('Computing');
            await tx.wait();

            await fetchHistory();
            setStatus('Complete');
            toast.success('Application submitted', { id: loadingToast });

            let activeAuth = authData;
            if (!isAuthValid(activeAuth)) {
                toast.loading('Authorizing decryption...', { id: loadingToast });
                activeAuth = await handleAuthorize();
            }

            if (activeAuth) {
                toast.loading('Decrypting tier...', { id: loadingToast });
                const latestApp = await contract.applicationCount() - 1n;
                const appData = await contract.applications(latestApp);
                const decryptResult = await instance.userDecrypt(
                    [{ handle: "0x" + BigInt(appData.encryptedTier).toString(16).padStart(64, '0'), contractAddress: contractFixed }],
                    activeAuth.keypair.privateKey, activeAuth.keypair.publicKey, activeAuth.signer,
                    [contractFixed], accountFixed, activeAuth.startTimestamp, activeAuth.durationDays
                );
                const val = Number(Object.values(decryptResult)[0]);
                setDecryptedTier(val);
                toast.success('Reputation verified', { id: loadingToast });
            }
        } catch (e: any) {
            console.error("Application error", e);
            toast.error(e?.message || "Application failed", { id: loadingToast });
            setStatus('');
        }
    };

    const tierConfig: Record<number, { label: string; sub: string; color: string; dot: string }> = {
        1: { label: 'Tier 1 — Elite', sub: 'High-activity, high-liquidity participant', color: 'text-emerald-400', dot: 'bg-emerald-400' },
        2: { label: 'Tier 2 — Trusted', sub: 'Solid on-chain footprint and healthy portfolio', color: 'text-amber-400', dot: 'bg-amber-400' },
        3: { label: 'Tier 3 — Emerging', sub: 'Increase activity or portfolio size to rank higher', color: 'text-red-400', dot: 'bg-red-400' },
    };

    return (
        <div className="max-w-4xl space-y-8 pb-16">
            {/* Header */}
            <div className="border-b border-white/[0.06] pb-6">
                <h1 className="text-xl font-semibold text-white tracking-tight mb-1">Private Credit</h1>
                <p className="text-sm text-text-muted">
                    Prove creditworthiness without revealing your financial data. Scoring is computed privately via FHE.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Application Form ── */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Criteria */}
                    <div className="bg-surface border border-white/[0.06] rounded-2xl p-5">
                        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-4">Scoring Criteria</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
                                <p className="text-[10px] font-bold text-primary/80 uppercase tracking-widest mb-1">Tier 1</p>
                                <p className="text-xs text-white/60 leading-relaxed">3+ tokens ≥1000 each<br/>10+ txns · 5+ days active</p>
                            </div>
                            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
                                <p className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest mb-1">Tier 2</p>
                                <p className="text-xs text-white/60 leading-relaxed">2+ tokens ≥500 each<br/>5+ txns · 3+ days active</p>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="bg-surface border border-white/[0.06] rounded-2xl p-5">
                        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-4">Your On-Chain Profile</p>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Transactions', value: verifiedStats.activity, sub: 'verified' },
                                { label: 'Active Since', value: verifiedStats.age, sub: 'on-chain' },
                                { label: 'Portfolio', value: 'Encrypted', sub: 'multi-asset scan' },
                            ].map(({ label, value, sub }) => (
                                <div key={label} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
                                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-1.5">{label}</p>
                                    <p className="text-base font-bold text-white tabular-nums">{value}</p>
                                    <p className="text-[10px] text-text-subtle mt-0.5">{sub}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Submit */}
                    <form onSubmit={handleSubmit}>
                        <button
                            type="submit"
                            disabled={!account || !!status || isInitializing || !instance}
                            className={`w-full h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                                !account
                                    ? 'bg-white/[0.04] text-text-muted cursor-not-allowed border border-white/[0.06]'
                                    : (status && status !== 'Complete') || isInitializing
                                    ? 'bg-primary/50 text-white/60 cursor-not-allowed'
                                    : 'bg-primary text-white hover:bg-primary-hover active:scale-[0.99]'
                            }`}
                        >
                            {((status && status !== 'Complete') || isInitializing) && <Loader2 size={15} className="animate-spin" />}
                            {isInitializing ? 'Initializing FHE...' :
                             status === 'Signing' ? 'Signing Transaction...' :
                             status === 'Computing' ? 'Computing via FHE...' :
                             status === 'Complete' ? 'Application Submitted' :
                             'Submit Application'}
                        </button>

                        {/* Progress bar */}
                        {status && status !== 'Complete' && (
                            <div className="mt-3 flex items-center gap-1">
                                {(['Signing', 'Computing'] as const).map((step, i) => {
                                    const idx = ['Signing', 'Computing'].indexOf(status);
                                    return (
                                        <div key={step} className="flex-1 flex flex-col gap-1">
                                            <div className={`h-0.5 rounded-full transition-all duration-300 ${i <= idx ? 'bg-primary' : 'bg-white/[0.06]'}`} />
                                            <span className={`text-[10px] font-medium ${i === idx ? 'text-primary' : 'text-text-subtle'}`}>{step}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </form>
                </div>

                {/* ── Right: Result + History ── */}
                <div className="space-y-4">
                    {/* Tier Result */}
                    <div className="bg-surface border border-white/[0.06] rounded-2xl p-5">
                        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-4">Score Tier</p>
                        {decryptedTier === null ? (
                            <div className="flex flex-col items-center justify-center text-center py-8 space-y-2">
                                <div className="h-10 w-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                                    <Lock size={16} className="text-text-subtle" />
                                </div>
                                <p className="text-xs text-text-muted leading-relaxed">Submit an application to reveal your private credit tier.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className={`h-2 w-2 rounded-full ${tierConfig[decryptedTier]?.dot || 'bg-text-muted'}`} />
                                    <span className={`text-sm font-bold ${tierConfig[decryptedTier]?.color || 'text-white'}`}>
                                        {tierConfig[decryptedTier]?.label || `Tier ${decryptedTier}`}
                                    </span>
                                </div>
                                <p className="text-xs text-text-muted leading-relaxed">{tierConfig[decryptedTier]?.sub}</p>
                                <div className="pt-2 border-t border-white/[0.05]">
                                    <p className="text-[10px] text-text-subtle leading-relaxed">
                                        Raw inputs were never exposed on-chain. Only this tier was computed via FHE.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* History */}
                    <div className="bg-surface border border-white/[0.06] rounded-2xl p-5">
                        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-4">History</p>
                        {loadingHistory ? (
                            <div className="flex justify-center py-6">
                                <Loader2 size={18} className="animate-spin text-text-subtle" />
                            </div>
                        ) : history.length === 0 ? (
                            <p className="text-xs text-text-muted text-center py-6">No applications yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {history.map(app => (
                                    <div key={app.id} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                                        <div>
                                            <p className="text-xs font-semibold text-white">#{app.id}</p>
                                            <p className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                                                <Clock size={9} />{app.date}
                                            </p>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                            app.status === 'Processed'
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : 'bg-amber-500/10 text-amber-400'
                                        }`}>
                                            {app.status}
                                        </span>
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
