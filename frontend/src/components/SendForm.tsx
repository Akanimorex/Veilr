import { useState } from 'react';
import { getAddress } from 'ethers';
import { useFhevm } from '../hooks/useFhevm';
import { useContract } from '../hooks/useContract';
import { toast } from 'react-hot-toast';
import { Loader2, ShieldCheck, Send as SendIcon } from 'lucide-react';

export const SendForm = () => {
    const { instance, account, isInitializing } = useFhevm();
    const { getContract, CONTRACT_ADDRESS } = useContract();
    
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('cUSDT');
    const [status, setStatus] = useState<'' | 'Encrypting' | 'Submitting' | 'Confirmed'>('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        setStatus('Encrypting');
        
        // Give React a moment to render the loading state before CPU-heavy work
        await new Promise(r => setTimeout(r, 50));

        if (!instance || !account || isInitializing) {
            toast.error("FHEVM not ready or wallet not connected");
            setStatus('');
            setIsProcessing(false);
            return;
        }

        const loadingToast = toast.loading("Encrypting transfer data...");
        
        try {
            const amountNum = Math.floor(parseFloat(amount));

            const accountFixed = getAddress(account.trim());
            const contractFixed = getAddress(CONTRACT_ADDRESS.trim());
            const recipientFixed = getAddress(recipient.trim());

            // Build encrypted input
            let input = instance.createEncryptedInput(contractFixed, accountFixed);
            input.addAddress(recipientFixed);
            input.add64(amountNum);

            const { handles, inputProof } = await input.encrypt();

            toast.loading('Submitting to network...', { id: loadingToast });
            setStatus('Submitting');
            
            const contract = await getContract(true);
            const tx = await contract.send(currency, handles[0], handles[1], inputProof);
            
            toast.loading('Awaiting on-chain confirmation...', { id: loadingToast });
            await tx.wait();

            toast.success('Confidential Transfer Sent!', { id: loadingToast });
            setStatus('Confirmed');
            setAmount('');
            setRecipient('');
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || "Transfer failed", { id: loadingToast });
            setStatus('');
        }
        setIsProcessing(false);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-surface p-6 rounded-2xl border border-white/5 space-y-6">
            <h2 className="text-xl font-medium text-white mb-4">Send Confidential Transfer</h2>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm text-text-muted mb-2">Recipient Address</label>
                    <input 
                        type="text" 
                        required
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder="0x..."
                        pattern="^0x[a-fA-F0-9]{40}$"
                        className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                    />
                </div>

                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-sm text-text-muted mb-2">Amount</label>
                        <input 
                            type="number" 
                            required
                            min="1"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>
                    <div className="w-1/3">
                        <label className="block text-sm text-text-muted mb-2">Currency</label>
                        <select 
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                        >
                            <option value="cUSDT">cUSDT</option>
                            <option value="cNGN">cNGN (Mock)</option>
                            <option value="cKES">cKES (Mock)</option>
                            <option value="cGHS">cGHS (Mock)</option>
                        </select>
                    </div>
                </div>
            </div>

            <button 
                type="submit" 
                disabled={!account || isProcessing || isInitializing || !instance}
                className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 ${
                    (!account || isProcessing || isInitializing) ? 'bg-primary/50 cursor-not-allowed opacity-70' 
                    : 'bg-primary hover:bg-primary-hover active:scale-95 shadow-lg shadow-primary/20'
                }`}
            >
                {(isProcessing || isInitializing) && (
                    <Loader2 size={20} className="animate-spin" />
                )}
                {isInitializing ? "Initializing FHE..." : 
                 status === 'Encrypting' ? "Encrypting Data..." : 
                 status === 'Submitting' ? "Submitting to Network..." :
                 (account ? "Encrypt & Send" : "Connect Wallet")}
            </button>

            {status === 'Confirmed' && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-center text-sm">
                    Transaction securely encrypted and submitted to network!
                </div>
            )}
        </form>
    );
};
