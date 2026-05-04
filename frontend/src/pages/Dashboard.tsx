import { useEffect, useState } from 'react';
import { useFhevm } from '../hooks/useFhevm';
import { useContract } from '../hooks/useContract';
import { RefreshCw, Loader2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAddress } from 'ethers';
import { toast } from 'react-hot-toast';


// Dashboard component
export const Dashboard = () => {
    const { account, instance, rawProvider, isInitializing } = useFhevm();
    const { getContract, CONTRACT_ADDRESS } = useContract();

    const [balance, setBalance] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [depositStatus, setDepositStatus] = useState<string>('');
    const [selectedCurrency, setSelectedCurrency] = useState<string>('cUSDT');
    const [authData, setAuthData] = useState<{ keypair: any, signer: string, startTimestamp: number, durationDays: number } | null>(null);
    const [creditAppCount, setCreditAppCount] = useState<number>(0);

    const currencies = [
        { symbol: 'cUSDT', label: 'Tether USD' },
        { symbol: 'cNGN', label: 'Naira' },
        { symbol: 'cKES', label: 'Shilling' },
        { symbol: 'cGHS', label: 'Cedi' },
    ];

    useEffect(() => {
        if (authData && account && CONTRACT_ADDRESS) {
            const sessionKey = `veilr_auth_${account.toLowerCase()}_${CONTRACT_ADDRESS.toLowerCase()}`;
            sessionStorage.setItem(sessionKey, JSON.stringify(authData));
        }
    }, [authData, account, CONTRACT_ADDRESS]);

    useEffect(() => {
        if (account && CONTRACT_ADDRESS) {
            const sessionKey = `veilr_auth_${account.toLowerCase()}_${CONTRACT_ADDRESS.toLowerCase()}`;
            const stored = sessionStorage.getItem(sessionKey);
            if (stored) {
                try { setAuthData(JSON.parse(stored)); } catch (e) {}
            } else {
                setAuthData(null);
            }
        }
    }, [account, CONTRACT_ADDRESS]);

    const handleAuthorize = async () => {
        if (!account || !instance) return;
        setLoading(true);
        try {
            const keypair = instance.generateKeypair();
            const startTimestamp = Math.floor(Date.now() / 1000) - 3600;
            const durationDays = 7;
            const eip712 = instance.createEIP712(keypair.publicKey, [getAddress(CONTRACT_ADDRESS)], startTimestamp, durationDays);
            const signer = await (rawProvider || (window as any).ethereum).request({
                method: 'eth_signTypedData_v4',
                params: [account, JSON.stringify(eip712, (_, value) =>
                    typeof value === 'bigint' ? value.toString() : value
                )],
            });
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
                setLoading(false);
                return;
            }

            try {
                const walletHandle = await contract.getBalanceFor(getAddress(account), selectedCurrency);
                if (walletHandle > 0n) {
                    const decryptResult = await instance.userDecrypt(
                        [{ handle: "0x" + BigInt(walletHandle).toString(16).padStart(64, '0'), contractAddress: getAddress(CONTRACT_ADDRESS) }],
                        activeAuth!.keypair.privateKey,
                        activeAuth!.keypair.publicKey,
                        activeAuth!.signer,
                        [getAddress(CONTRACT_ADDRESS)],
                        getAddress(account),
                        activeAuth!.startTimestamp,
                        activeAuth!.durationDays
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
        } catch (error: any) {
            const errStr = String(error?.message || error);
            if (!errStr.includes('503') && !errStr.includes('500')) {
                console.error("Failed to fetch balances:", error);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        if (account && instance) fetchBalances();
    }, [account, instance, selectedCurrency, authData]);

    useEffect(() => {
        const fetchCreditCount = async () => {
            if (!account) return;
            try {
                const contract = await getContract();
                const filter = contract.filters.CreditApplicationSubmitted(null, account);
                const events = await contract.queryFilter(filter, -10000);
                setCreditAppCount(events.length);
            } catch (e) {}
        };
        fetchCreditCount();
    }, [account]);

    const handleMint = async () => {
        if (!account) { toast.error("Please connect your wallet first!"); return; }
        if (isInitializing || !instance) return;
        const loadingToast = toast.loading(`Minting 1000 ${selectedCurrency}...`);
        try {
            setLoading(true);
            const contract = await getContract(true);
            const tx = await contract.mint(selectedCurrency, 1000);
            toast.loading('Awaiting on-chain confirmation...', { id: loadingToast });
            await tx.wait();
            toast.loading('Syncing with FHE Gateway...', { id: loadingToast });
            const MAX_POLLS = 10;
            for (let i = 0; i < MAX_POLLS; i++) {
                await fetchBalances();
                if (balance !== '0.00' && balance !== null && !balance.includes('Syncing')) {
                    toast.success(`${selectedCurrency} minted successfully`, { id: loadingToast });
                    setLoading(false);
                    setDepositStatus('');
                    return;
                }
                await new Promise(r => setTimeout(r, 10000));
            }
            toast.success('Minting complete. Balance updating...', { id: loadingToast });
        } catch (error: any) {
            console.error("Mint error:", error);
            toast.error(error?.message || "Minting failed", { id: loadingToast });
        }
        setLoading(false);
        setDepositStatus('');
    };

    // ─── Not connected state ──────────────────────────────────────────────────
    if (!account) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-2">
                    <div className="h-5 w-5 rounded-md bg-primary/30 border border-primary/40 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-sm bg-primary" />
                    </div>
                </div>
                <h1 className="text-2xl font-semibold text-white tracking-tight">Connect your wallet</h1>
                <p className="text-text-muted text-sm max-w-xs leading-relaxed">
                    Veilr uses Fully Homomorphic Encryption to keep your balances private on-chain.
                </p>
            </div>
        );
    }

    // ─── Connected state ──────────────────────────────────────────────────────
    return (
        <div className="space-y-6">

            {/* ── Top row: Balance card + Stat cards ── */}
            <div className="grid grid-cols-12 gap-4">

                {/* Balance Card */}
                <div className="col-span-12 md:col-span-5 bg-surface border border-white/[0.06] rounded-2xl p-6 flex flex-col justify-between min-h-[200px]">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Balance</p>
                            <p className="text-[11px] text-text-subtle mt-0.5">{selectedCurrency}</p>
                        </div>
                        <button
                            onClick={fetchBalances}
                            disabled={loading}
                            className="h-7 w-7 flex items-center justify-center rounded-lg border border-white/[0.06] text-text-muted hover:text-white hover:border-white/10 transition-all"
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    <div>
                        <div className="flex items-end gap-2 mb-4">
                            <span className="text-5xl font-bold tracking-tighter text-white tabular-nums">
                                {loading ? (
                                    <span className="text-text-subtle">—</span>
                                ) : authData ? (
                                    balance || '0.00'
                                ) : (
                                    <span className="text-text-subtle text-3xl">Locked</span>
                                )}
                            </span>
                        </div>

                        {!authData ? (
                            <button
                                onClick={handleAuthorize}
                                className="text-[11px] font-semibold text-primary hover:text-primary-hover transition-colors flex items-center gap-1"
                            >
                                Authorize to decrypt <ChevronRight size={12} />
                            </button>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                <span className="text-[11px] font-medium text-emerald-400/80">Decrypted</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right column: Currency + Stats */}
                <div className="col-span-12 md:col-span-7 grid grid-cols-2 gap-4">
                    {/* Currency selector */}
                    <div className="col-span-2 bg-surface border border-white/[0.06] rounded-2xl p-4">
                        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-3">Asset</p>
                        <div className="grid grid-cols-4 gap-2">
                            {currencies.map(c => (
                                <button
                                    key={c.symbol}
                                    onClick={() => setSelectedCurrency(c.symbol)}
                                    className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                                        selectedCurrency === c.symbol
                                            ? 'bg-primary/15 text-primary border border-primary/25'
                                            : 'bg-white/[0.03] text-text-muted border border-white/[0.05] hover:border-white/10 hover:text-white'
                                    }`}
                                >
                                    {c.symbol.replace('c', '')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Credit Status */}
                    <Link to="/credit" className="bg-surface border border-white/[0.06] rounded-2xl p-4 hover:border-white/10 transition-all group">
                        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2">Credit</p>
                        <p className="text-lg font-bold text-white">
                            {creditAppCount > 0 ? 'Verified' : 'Unranked'}
                        </p>
                        <p className="text-[11px] text-text-muted mt-1 group-hover:text-text-muted transition-colors">
                            {creditAppCount > 0 ? `${creditAppCount} application${creditAppCount > 1 ? 's' : ''}` : 'Apply now →'}
                        </p>
                    </Link>

                    {/* Faucet */}
                    <button
                        onClick={handleMint}
                        disabled={loading || !!depositStatus}
                        className="bg-surface border border-white/[0.06] rounded-2xl p-4 hover:border-white/10 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2">Faucet</p>
                        <p className="text-lg font-bold text-white">
                            {loading ? (
                                <Loader2 size={18} className="animate-spin text-primary" />
                            ) : (
                                `Mint 1000`
                            )}
                        </p>
                        <p className="text-[11px] text-text-muted mt-1">{selectedCurrency} testnet tokens</p>
                    </button>
                </div>
            </div>

            {/* ── Quick Actions ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                    to="/send"
                    className="bg-surface border border-white/[0.06] rounded-2xl p-5 hover:border-white/10 transition-all flex items-center justify-between group"
                >
                    <div>
                        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">Encrypted Send</p>
                        <p className="text-sm font-medium text-white">Transfer assets privately using FHE</p>
                    </div>
                    <ChevronRight size={16} className="text-text-muted group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </Link>

                <Link
                    to="/credit"
                    className="bg-surface border border-white/[0.06] rounded-2xl p-5 hover:border-white/10 transition-all flex items-center justify-between group"
                >
                    <div>
                        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">Private Credit</p>
                        <p className="text-sm font-medium text-white">Verify reputation without revealing data</p>
                    </div>
                    <ChevronRight size={16} className="text-text-muted group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </Link>
            </div>

            {/* ── Protocol info strip ── */}
            <div className="flex items-center gap-6 px-1 py-2 border-t border-white/[0.04]">
                {[
                    { label: 'Protocol', value: 'FHEVM' },
                    { label: 'Network', value: 'Sepolia' },
                    { label: 'Encryption', value: 'FHE / ZK' },
                    { label: 'Contract', value: `${CONTRACT_ADDRESS?.slice(0, 6)}...${CONTRACT_ADDRESS?.slice(-4)}` },
                ].map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-2">
                        <span className="text-[10px] text-text-subtle font-medium uppercase tracking-widest">{label}</span>
                        <span className="text-[10px] font-mono text-text-muted">{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
