import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserProvider } from 'ethers';
import { createInstance, SepoliaConfig, FhevmInstance, initSDK } from '@zama-fhe/relayer-sdk/web';

export interface FhevmContextType {
  instance: FhevmInstance | null;
  provider: BrowserProvider | null;
  rawProvider: any | null;
  account: string | null;
  connect: () => Promise<void>;
}

const FhevmContext = createContext<FhevmContextType>({
  instance: null,
  provider: null,
  rawProvider: null,
  account: null,
  connect: async () => {},
});

export const useFhevm = () => useContext(FhevmContext);

export const FhevmProvider = ({ children }: { children: React.ReactNode }) => {
  const [instance, setInstance] = useState<FhevmInstance | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [rawProvider, setRawProvider] = useState<any | null>(null);
  const [account, setAccount] = useState<string | null>(null);

  const connect = async () => {
    // 1. Identify active provider (handling cases with multiple wallets like Compass/MetaMask)
    let activeProvider = window.ethereum;
    if (window.ethereum?.providers) {
        console.log("Multiple providers detected:", window.ethereum.providers.map((p: any) => p.isMetaMask ? "MetaMask" : "Other"));
        activeProvider = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum.providers[0];
    }

    if (!activeProvider) {
      console.error("No active provider found");
      alert("No Ethereum wallet found. Please install MetaMask!");
      return;
    }

    try {
      console.log("Connecting wallet via provider:", activeProvider.isMetaMask ? "MetaMask" : "Generic/Other");
      
      // 2. Prompt user to connect
      await activeProvider.request({ method: 'eth_requestAccounts' });
      
      // 3. Ensure accounts are actually ready (prevents "wallet must has at least one account" error)
      let accounts: string[] = [];
      console.log("Waiting for accounts to be visible...");
      for (let i = 0; i < 20; i++) { // Increased to 20 attempts (4 seconds)
        accounts = await activeProvider.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            console.log("Account detected:", accounts[0]);
            break;
        }
        await new Promise(r => setTimeout(r, 200));
      }

      if (accounts.length === 0) {
        throw new Error("Wallet connected but accounts are not available yet. Please ensure your wallet is unlocked and has at least one account.");
      }

      const ethersProvider = new BrowserProvider(activeProvider);
      setProvider(ethersProvider);
      setRawProvider(activeProvider);
      setAccount(accounts[0]);

      // 4. Force network to Sepolia Testnet
      const chainId = 11155111;
      const network = await ethersProvider.getNetwork();
      console.log("Current Chain ID:", network.chainId.toString());
      if (Number(network.chainId) !== chainId) {
        console.log("Switching to Sepolia Testnet...");
        try {
          await activeProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }], // 11155111 in hex
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            console.log("Adding Sepolia Testnet to wallet...");
            await activeProvider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0xaa36a7',
                chainName: 'Sepolia Testnet',
                rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
                nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 }
              }]
            });
          } else {
            throw switchError;
          }
        }
      }

      // 5. Initialize FHEVM SDK
      console.log("Initializing FHEVM SDK...");
      await initSDK();
      const sdkInstance = await createInstance({
          ...SepoliaConfig,
          network: activeProvider
      });
      setInstance(sdkInstance);
      localStorage.setItem('walletConnected', 'true');
      console.log("FHEVM Initialized successfully");
    } catch (err: any) {
      console.error("FHEVM Connection Error:", err);
      const errorMsg = err.code === 4001 ? "Wallet connection rejected by user." : 
                      err.message?.includes("at least one account") ? "No accounts found! Please ensure you have an account in MetaMask and it's unlocked." :
                      err.message || err.toString();
      alert("Error initializing FHEVM: " + errorMsg);
    }
  };

  useEffect(() => {
    // Auto-connect if previously connected to prevent dropping state on reload
    if (localStorage.getItem('walletConnected') === 'true') {
        connect();
    }

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        console.log("Accounts changed event:", accounts);
        if (accounts.length > 0) {
            const cleanAccount = String(accounts[0]).trim();
            setAccount(cleanAccount);
            console.log("Active account updated to:", cleanAccount);
        } else {
            setAccount(null);
            localStorage.removeItem('walletConnected');
        }
      });
      window.ethereum.on('chainChanged', (chainId: string) => {
        console.log("Chain changed to:", chainId);
        // Removed automatic reload to prevent state loss during transactions
      });
    }
  }, []);

  return (
    <FhevmContext.Provider value={{ instance, provider, rawProvider, account, connect }}>
      {children}
    </FhevmContext.Provider>
  );
};

