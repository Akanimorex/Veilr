import { useFhevm } from '../hooks/useFhevm';
import { LogOut } from 'lucide-react';

export const WalletConnect = () => {
    const { account, connect, disconnect, isWrongNetwork } = useFhevm();
    const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    if (!account) {
        return (
            <button
                onClick={connect}
                className="px-3.5 py-1.5 bg-white text-black text-sm font-semibold rounded-md hover:bg-white/90 transition-colors"
            >
                Connect Wallet
            </button>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-mono ${
                isWrongNetwork
                    ? 'border-red-500/20 bg-red-500/5 text-red-400'
                    : 'border-white/[0.08] bg-white/[0.04] text-white/80'
            }`}>
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isWrongNetwork ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`} />
                {isWrongNetwork ? 'Wrong Network' : truncate(account)}
            </div>
            <button
                onClick={disconnect}
                className="h-[30px] w-[30px] flex items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] text-text-muted hover:text-white hover:bg-white/[0.08] transition-all"
                title="Disconnect"
            >
                <LogOut size={13} />
            </button>
        </div>
    );
};
