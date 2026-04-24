import { Clock } from 'lucide-react';

export const TransactionHistory = () => {
    // Mock data to demonstrate UI since FHEVM indexing takes time to setup
    const history = [
        { nonce: 142, timestamp: Date.now() - 3600000, status: 'Confirmed' },
        { nonce: 141, timestamp: Date.now() - 86400000, status: 'Confirmed' },
        { nonce: 140, timestamp: Date.now() - 172800000, status: 'Confirmed' },
    ];

    return (
        <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <Clock size={18} className="text-primary" />
                    Recent Transactions
                </h3>
                <p className="text-sm text-text-muted mt-1">Transaction amounts are end-to-end encrypted on-chain.</p>
            </div>
            
            <div className="divide-y divide-white/5">
                {history.map((tx) => (
                    <div key={tx.nonce} className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                        <div>
                            <p className="text-sm font-medium text-white">Tx Nonce #{tx.nonce}</p>
                            <p className="text-xs text-text-muted mt-1">{new Date(tx.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                            <span className="inline-block px-3 py-1 bg-green-500/10 text-green-400 text-xs font-medium rounded-full">
                                {tx.status}
                            </span>
                            <p className="text-xs text-text-muted mt-2">Amount: <span className="font-mono bg-white/10 px-1 py-0.5 rounded text-white/50">Encrypted</span></p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
