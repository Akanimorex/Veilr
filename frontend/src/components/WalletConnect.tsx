import { useFhevm } from '../hooks/useFhevm';
import { Wallet, LogOut } from 'lucide-react';

export const WalletConnect = () => {
    const { account, connect, disconnect, isWrongNetwork, switchNetwork } = useFhevm();

    const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    return (
        <div className="flex items-center gap-2">
            {!account ? (
                <button 
                    onClick={connect}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full transition-all text-sm font-bold hover:bg-primary-hover active:scale-95"
                >
                    <Wallet size={16} />
                    Connect Wallet
                </button>
            ) : (
                <>
                    <div className={`flex items-center gap-2 px-4 py-2 bg-surface border rounded-full text-sm font-medium ${isWrongNetwork ? 'border-red-500/50 text-red-400' : 'border-white/10 text-white'}`}>
                        <div className={`w-2 h-2 rounded-full ${isWrongNetwork ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                        <span>{isWrongNetwork ? "Wrong Network" : truncate(account)}</span>
                    </div>
                    <button 
                        onClick={disconnect}
                        className="p-2 bg-surface hover:bg-red-400/10 border border-white/10 rounded-full text-red-400 transition-all hover:border-red-400/20"
                        title="Disconnect Wallet"
                    >
                        <LogOut size={16} />
                    </button>
                </>
            )}
        </div>
    );
};
