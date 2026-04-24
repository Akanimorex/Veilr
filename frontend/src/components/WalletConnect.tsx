import { useFhevm } from '../hooks/useFhevm';
import { Wallet } from 'lucide-react';

export const WalletConnect = () => {
    const { account, connect } = useFhevm();

    const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    return (
        <button 
            onClick={connect}
            className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-white/5 border border-white/10 rounded-full transition-all text-sm font-medium"
        >
            <Wallet size={16} className="text-primary" />
            {account ? truncate(account) : "Connect Wallet"}
        </button>
    );
};
