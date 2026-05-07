import { useState } from 'react';
import { getAddress } from 'ethers';
import { useFhevm } from '../hooks/useFhevm';
import { useContract } from '../hooks/useContract';
import { toast } from 'react-hot-toast';
import { Loader2, Lock } from 'lucide-react';

/** Ensure a hex value is exactly 32 bytes (bytes32) as required by the ABI. */
function padBytes32(hex: string): string {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    return '0x' + clean.padStart(64, '0');
}

// Helper: run the heavy FHE encryption in a Web Worker so the main thread
// (and therefore the UI) stays responsive throughout.
function encryptInWorker(
    contractAddress: string,
    userAddress: string,
    recipientAddress: string,
    amountNum: number
): Promise<{ handles: string[]; inputProof: string }> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(
            new URL('../workers/encryption.worker.ts', import.meta.url),
            { type: 'module' }
        );

        const timeout = setTimeout(() => {
            worker.terminate();
            reject(new Error('Encryption timed out (120s). This usually happens if the FHE WASM is taking a long time to initialize or the network is slow.'));
        }, 120_000);


        worker.onmessage = (e) => {
            clearTimeout(timeout);
            worker.terminate();
            if (e.data.success) {
                resolve({ handles: e.data.handles, inputProof: e.data.inputProof });
            } else {
                reject(new Error(e.data.error ?? 'Encryption failed in worker'));
            }
        };

        worker.onerror = (err) => {
            clearTimeout(timeout);
            worker.terminate();
            reject(err);
        };

        worker.postMessage({
            contractAddress,
            userAddress,
            values: [
                { type: 'address', value: recipientAddress },
                { type: 'uint64',  value: amountNum },
            ],
        });
    });
}

export const SendForm = () => {
    const { instance, account, isInitializing } = useFhevm();
    const { getContract, CONTRACT_ADDRESS } = useContract();

    const [recipient, setRecipient] = useState('');
    const [amount, setAmount]       = useState('');
    const [currency, setCurrency]   = useState('cUSDT');
    const [status, setStatus]       = useState<'' | 'Encrypting' | 'Submitting' | 'Confirmed'>('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!instance || !account || isInitializing) {
            toast.error('FHEVM not ready or wallet not connected');
            return;
        }

        setIsProcessing(true);
        setStatus('Encrypting');

        const loadingToast = toast.loading('Encrypting transfer data (off-thread)…');

        try {
            const amountNum       = Math.floor(parseFloat(amount));
            const accountFixed    = getAddress(account.trim());
            const contractFixed   = getAddress(CONTRACT_ADDRESS.trim());
            const recipientFixed  = getAddress(recipient.trim());

            // ── Heavy WASM work happens in a worker; main thread stays free ──
            const encryptionResult = await encryptInWorker(
                contractFixed,
                accountFixed,
                recipientFixed,
                amountNum
            );
            
            console.log("Encryption Result:", encryptionResult);
            const { handles, inputProof } = encryptionResult;

            // Ensure handles are properly padded bytes32 values.
            const handle0 = padBytes32(handles[0]);
            const handle1 = padBytes32(handles[1]);
            
            console.log("Padded Handles:", { handle0, handle1 });


            toast.loading('Submitting to network…', { id: loadingToast });
            setStatus('Submitting');

            const contract = await getContract(true);
            const tx = await contract.send(currency, handle0, handle1, inputProof);

            toast.loading('Awaiting on-chain confirmation…', { id: loadingToast });
            await tx.wait();

            toast.success('Transfer sent successfully', { id: loadingToast });
            setStatus('Confirmed');
            setAmount('');
            setRecipient('');
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message ?? 'Transfer failed', { id: loadingToast });
            setStatus('');
        } finally {
            setIsProcessing(false);
        }
    };

    const currencies = ['cUSDT', 'cNGN', 'cKES', 'cGHS'];

    return (
        <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
            <div>
                <h1 className="text-xl font-semibold text-white tracking-tight mb-1">Encrypted Send</h1>
                <p className="text-sm text-text-muted">Transfer assets privately. Amounts are encrypted via FHE before hitting the chain.</p>
            </div>

            <div className="space-y-3">
                {/* Recipient */}
                <div className="bg-surface border border-white/[0.06] rounded-xl p-4 space-y-1.5 focus-within:border-white/12 transition-colors">
                    <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Recipient Address</label>
                    <input
                        type="text"
                        required
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder="0x..."
                        pattern="^0x[a-fA-F0-9]{40}$"
                        className="w-full bg-transparent text-sm text-white placeholder:text-text-subtle font-mono focus:outline-none"
                    />
                </div>

                {/* Amount + Currency row */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 bg-surface border border-white/[0.06] rounded-xl p-4 space-y-1.5 focus-within:border-white/12 transition-colors">
                        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Amount</label>
                        <input
                            type="number"
                            required
                            min="1"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                            className="w-full bg-transparent text-2xl font-bold text-white placeholder:text-text-subtle focus:outline-none tabular-nums"
                        />
                    </div>
                    <div className="bg-surface border border-white/[0.06] rounded-xl p-4 space-y-1.5">
                        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Asset</label>
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="w-full bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer appearance-none"
                        >
                            {currencies.map(c => <option key={c} value={c} className="bg-surface">{c}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Encryption note */}
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/[0.06] border border-primary/10 rounded-lg">
                <Lock size={12} className="text-primary shrink-0" />
                <p className="text-[11px] text-primary/80 font-medium">
                    Encryption runs off the main thread — the app stays responsive.
                </p>
            </div>

            {/* Submit Button */}
            <button
                type="submit"
                disabled={!account || isProcessing || isInitializing || !instance}
                className={`w-full h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    !account
                        ? 'bg-white/[0.04] text-text-muted cursor-not-allowed border border-white/[0.06]'
                        : isProcessing || isInitializing
                        ? 'bg-primary/50 text-white/60 cursor-not-allowed'
                        : 'bg-primary text-white hover:bg-primary-hover active:scale-[0.99]'
                }`}
            >
                {(isProcessing || isInitializing) && <Loader2 size={15} className="animate-spin" />}
                {isInitializing    ? 'Initializing FHE…'  :
                 status === 'Encrypting' ? 'Encrypting…'  :
                 status === 'Submitting' ? 'Submitting…'  :
                 account ? 'Encrypt & Send' : 'Connect Wallet'}
            </button>

            {status === 'Confirmed' && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/[0.06] border border-emerald-500/10 rounded-xl text-emerald-400 text-xs font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    Transfer submitted to network. Encrypted on-chain.
                </div>
            )}
        </form>
    );
};
