import { useState } from 'react';
import { getAddress } from 'ethers';
import { useFhevm } from '../hooks/useFhevm';
import { useContract } from '../hooks/useContract';

export const SendForm = () => {
    const { instance, account } = useFhevm();
    const { getContract, CONTRACT_ADDRESS } = useContract();
    
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('cUSDT');
    const [status, setStatus] = useState<'' | 'Encrypting' | 'Submitting' | 'Confirmed'>('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!instance || !account) return;

        try {
            setStatus('Encrypting');
            
            const amountNum = Math.floor(parseFloat(amount));

            // FHEVM Encryption using relayer SDK
            const accountFixed = getAddress(account.trim());
            const contractFixed = getAddress(CONTRACT_ADDRESS.trim());
            const recipientFixed = getAddress(recipient.trim());

            // Build encrypted input
            let input = instance.createEncryptedInput(contractFixed, accountFixed);
            
            // Add inputs in order: recipient (address), amount (uint64)
            input.addAddress(recipientFixed);
            input.add64(amountNum);

            // Encrypt and generate proof
            const { handles, inputProof } = await input.encrypt();

            setStatus('Submitting');
            
            const contract = await getContract(true);

            // Send transaction: send(symbol, recipientHandle, amountHandle, proof)
            const tx = await contract.send(currency, handles[0], handles[1], inputProof);
            await tx.wait();

            setStatus('Confirmed');
            setAmount('');
            setRecipient('');
        } catch (error) {
            console.error(error);
            setStatus('');
        }
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
                disabled={!account || !!status}
                className={`w-full py-4 rounded-xl font-medium transition-all ${
                    !account ? 'bg-primary/50 cursor-not-allowed opacity-50' 
                    : !!status ? 'bg-primary/80 animate-pulse'
                    : 'bg-primary hover:bg-primary-hover active:scale-95'
                }`}
            >
                {status || (account ? "Encrypt & Send" : "Connect Wallet to Send")}
            </button>

            {status === 'Confirmed' && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-center text-sm">
                    Transaction securely encrypted and submitted to network!
                </div>
            )}
        </form>
    );
};
