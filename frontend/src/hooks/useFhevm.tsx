import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserProvider } from 'ethers';
import { createInstance, SepoliaConfig, FhevmInstance, initSDK } from '@zama-fhe/relayer-sdk/web';

declare global {
  interface Window {
    ethereum: any;
  }
}

export interface FhevmContextType {
  instance: FhevmInstance | null;
  provider: BrowserProvider | null;
  rawProvider: any | null;
  account: string | null;
  isInitializing: boolean;
  isWrongNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
}

const FhevmContext = createContext<FhevmContextType>({
  instance: null,
  provider: null,
  rawProvider: null,
  account: null,
  isInitializing: false,
  isWrongNetwork: false,
  connect: async () => {},
  disconnect: () => {},
  switchNetwork: async () => {},
});

export const useFhevm = () => useContext(FhevmContext);

export const FhevmProvider = ({ children }: { children: React.ReactNode }) => {
  const [instance, setInstance] = useState<FhevmInstance | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [rawProvider, setRawProvider] = useState<any | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);

  const REQUIRED_CHAIN_ID = 11155111;

  const switchNetwork = async () => {
    if (!rawProvider) return;
    try {
        await rawProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }],
        });
    } catch (switchError: any) {
        if (switchError.code === 4902) {
            await rawProvider.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0xaa36a7',
                    chainName: 'Sepolia Testnet',
                    rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
                    nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 }
                }]
            });
        }
    }
  };

  const disconnect = () => {
    setAccount(null);
    setInstance(null);
    setProvider(null);
    setRawProvider(null);
    localStorage.removeItem('walletConnected');
    // Clear any cached authorization for this specific user session
    const keys = Object.keys(sessionStorage);
    keys.forEach(k => {
        if (k.startsWith('veilr_auth_')) sessionStorage.removeItem(k);
    });
  };

  const connect = async () => {
    let activeProvider = window.ethereum;
    if (window.ethereum?.providers) {
        activeProvider = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum.providers[0];
    }

    if (!activeProvider) {
      alert("No Ethereum wallet found. Please install MetaMask!");
      return;
    }

    try {
      console.log("Requesting account connection...");
      console.log("Provider detected as:", activeProvider.isMetaMask ? "MetaMask" : "Other");
      
      const accountsRequest = await activeProvider.request({ method: 'eth_requestAccounts' });
      console.log("eth_requestAccounts result:", accountsRequest);
      
      // Retry loop to ensure accounts are visible
      let accounts: string[] = [];
      for (let i = 0; i < 15; i++) {
          accounts = await activeProvider.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) break;
          console.log(`Waiting for accounts... attempt ${i+1}`);
          await new Promise(r => setTimeout(r, 500));
      }

      if (accounts && accounts.length > 0) {
        const cleanAccount = String(accounts[0]).toLowerCase();
        console.log("Connected account confirmed:", cleanAccount);
        setAccount(cleanAccount);
        setRawProvider(activeProvider);
        setProvider(new BrowserProvider(activeProvider));
        localStorage.setItem('walletConnected', 'true');
      } else {
        throw new Error("Wallet connected but no accounts were returned. Please ensure your wallet is unlocked.");
      }
    } catch (err: any) {
      console.error("Connection Error:", err);
      if (err.code !== 4001) {
          alert("Connection Error: " + (err.message || "Failed to find active account"));
      }
    }
  };

  useEffect(() => {
    const initFhe = async () => {
        if (!account || !rawProvider || !provider) return;
        
        setIsInitializing(true);
        try {
            // 0. Double check accounts are actually available to the provider
            const checkAccounts = await rawProvider.request({ method: 'eth_accounts' });
            if (!checkAccounts || checkAccounts.length === 0) {
                console.warn("FHEVM: Provider has no active accounts. Delaying init...");
                return;
            }

            // 1. Check Network
            const network = await provider.getNetwork();
            if (Number(network.chainId) !== REQUIRED_CHAIN_ID) {
                setIsWrongNetwork(true);
                setIsInitializing(false);
                return;
            } else {
                setIsWrongNetwork(false);
            }

            // 2. Init SDK
            console.log("Initializing FHEVM instance for:", account);
            await initSDK();
            const sdkInstance = await createInstance({
                ...SepoliaConfig,
                network: rawProvider
            });
            setInstance(sdkInstance);
            console.log("FHEVM Ready");
        } catch (err) {
            console.error("FHEVM Initialization failed:", err);
        } finally {
            setIsInitializing(false);
        }
    };

    initFhe();
  }, [account, provider, rawProvider]);

  useEffect(() => {
    if (localStorage.getItem('walletConnected') === 'true') {
        connect();
    }

    if (window.ethereum) {
      const getActiveProvider = () => {
          if (window.ethereum?.providers) {
              return window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum.providers[0];
          }
          return window.ethereum;
      };

      const handleAccounts = (accounts: string[]) => {
        const activeProvider = getActiveProvider();
        if (accounts.length > 0) {
            setAccount(accounts[0]);
            setRawProvider(activeProvider);
            setProvider(new BrowserProvider(activeProvider));
        } else {
            setAccount(null);
            setInstance(null);
            localStorage.removeItem('walletConnected');
        }
      };

      window.ethereum.on('accountsChanged', handleAccounts);
      window.ethereum.on('chainChanged', () => window.location.reload());

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccounts);
      };
    }
  }, []);

  return (
    <FhevmContext.Provider value={{ instance, provider, rawProvider, account, isInitializing, isWrongNetwork, connect, disconnect, switchNetwork }}>
      {children}
    </FhevmContext.Provider>
  );
};

