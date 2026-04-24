import { useState, useEffect } from 'react';
import { useFhevm } from '../hooks/useFhevm';
import { useContract } from '../hooks/useContract';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, UserCheck } from 'lucide-react';

interface ComplianceRequest {
    nonce: number;
    symbol: string;
    timestamp: number;
    signatures: number;
    approved: boolean;
    alreadySigned: boolean;
}

export const Compliance = () => {
    const { account } = useFhevm();
    const { getContract } = useContract();

    const [requests, setRequests] = useState<ComplianceRequest[]>([]);
    const [isCompliance, setIsCompliance] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [signingNonce, setSigningNonce] = useState<number | null>(null);

    const checkRole = async () => {
        if (!account) return;
        try {
            const contract = await getContract();
            const roleHash = await contract.COMPLIANCE_ROLE();
            const hasRole = await contract.hasRole(roleHash, account);
            setIsCompliance(hasRole);
        } catch (e) {
            console.error("Error checking role:", e);
            setIsCompliance(false);
        }
    };

    const fetchRequests = async () => {
        if (!account) return;
        setLoading(true);
        try {
            const contract = await getContract();
            
            // 1. Get all TransferInitiated events
            // In a production app, we would use a more efficient indexing service
            const filter = contract.filters.TransferInitiated();
            const events = await contract.queryFilter(filter, -5000); // Look back ~5000 blocks
            
            const reqs: ComplianceRequest[] = [];
            
            for (const event of events) {
                const nonce = Number((event as any).args.nonce);
                const symbol = (event as any).args.symbol;
                const timestamp = Number((event as any).args.timestamp);
                
                // Fetch current status from contract
                const status = await contract.decryptionRequests(nonce);
                const alreadySigned = await contract.hasSigned(nonce, account);
                
                reqs.push({
                    nonce,
                    symbol,
                    timestamp,
                    signatures: Number(status.signaturesCount),
                    approved: status.approved,
                    alreadySigned
                });
            }
            
            // Sort by latest first
            setRequests(reqs.sort((a, b) => b.nonce - a.nonce));
        } catch (e) {
            console.error("Error fetching requests:", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (account) {
            checkRole();
            fetchRequests();
        }
    }, [account]);

    const handleSign = async (nonce: number) => {
        setSigningNonce(nonce);
        try {
            const contract = await getContract(true);
            const tx = await contract.signDecryptionRequest(nonce);
            await tx.wait();
            
            // Refresh the specific request
            await fetchRequests();
        } catch (e) {
            console.error("Signing failed:", e);
            alert("Transaction failed. Make sure you have the COMPLIANCE_ROLE.");
        }
        setSigningNonce(null);
    };

    if (!account) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                <AlertTriangle size={48} className="mb-4 opacity-50" />
                <p>Please connect your wallet first.</p>
            </div>
        );
    }

    if (isCompliance === false) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                <ShieldCheck size={48} className="mb-4 text-red-500/50" />
                <h2 className="text-xl font-medium text-white mb-2">Access Denied</h2>
                <p className="max-w-md text-center">Your account does not have the <b>COMPLIANCE_ROLE</b> required to view or sign audit requests.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="mb-8 border-b border-white/10 pb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-semibold text-white tracking-tight mb-3">Compliance Portal</h1>
                    <p className="text-text-muted max-w-2xl">
                        Review and co-sign threshold decryption requests for potentially non-compliant transactions. 
                        Requires 2/2 multi-sig to reveal encrypted details to the regulator.
                    </p>
                </div>
                {isCompliance && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">
                        <UserCheck size={14} /> Authorized Officer
                    </div>
                )}
            </div>

            {loading && requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="animate-spin text-primary mb-4" size={32} />
                    <p className="text-text-muted">Scanning blockchain for requests...</p>
                </div>
            ) : requests.length === 0 ? (
                <div className="bg-surface border border-white/5 rounded-2xl p-12 text-center">
                    <p className="text-text-muted">No decryption requests found on-chain.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {requests.map(req => (
                        <div key={req.nonce} className={`p-6 rounded-2xl border transition-all ${req.approved ? 'border-primary/20 bg-primary/5' : 'border-white/5 bg-surface'} flex items-center justify-between`}>
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-white font-medium">Tx Nonce #{req.nonce}</h3>
                                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-white/5 text-text-muted">
                                        {req.symbol}
                                    </span>
                                    {req.approved && (
                                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-primary/20 text-primary flex items-center gap-1">
                                            <CheckCircle2 size={10} /> Fully Approved
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-text-muted mb-4">
                                    Detected: {new Date(req.timestamp * 1000).toLocaleString()}
                                </p>
                                
                                <div className="flex items-center gap-3">
                                    <div className="flex gap-1">
                                        {[1, 2].map(i => (
                                            <div 
                                                key={i} 
                                                className={`h-1.5 w-10 rounded-full transition-colors ${i <= req.signatures ? 'bg-primary' : 'bg-white/10'}`} 
                                            />
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-text-muted uppercase tracking-wider font-semibold">
                                        {req.signatures}/2 Signatures
                                    </p>
                                </div>
                            </div>

                            <div>
                                {req.approved ? (
                                    <div className="text-primary text-sm font-medium flex items-center gap-2">
                                        Available to Regulator
                                    </div>
                                ) : req.alreadySigned ? (
                                    <div className="text-text-muted text-sm font-medium flex items-center gap-2 italic">
                                        You have signed
                                    </div>
                                ) : (
                                    <button 
                                        disabled={signingNonce !== null}
                                        onClick={() => handleSign(req.nonce)}
                                        className="px-6 py-2 bg-white text-background hover:bg-white/90 disabled:opacity-50 rounded-xl transition-all text-sm font-bold flex items-center gap-2"
                                    >
                                        {signingNonce === req.nonce ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <ShieldCheck size={16} />
                                        )}
                                        Co-sign Decryption
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
