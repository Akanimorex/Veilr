import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FhevmProvider } from './hooks/useFhevm';
import { Toaster } from 'react-hot-toast';
import { WalletConnect } from './components/WalletConnect';
import { Dashboard } from './pages/Dashboard';
import { Send } from './pages/Send';
import { Compliance } from './pages/Compliance';
import { Credit } from './pages/Credit';
import { ShieldAlert, BadgeCheck, Send as SendIcon, AlertTriangle, RefreshCw } from 'lucide-react';
import { useFhevm } from './hooks/useFhevm';

const NetworkBanner = () => {
  const { isWrongNetwork, switchNetwork, account } = useFhevm();

  if (!account || !isWrongNetwork) return null;

  return (
    <div className="bg-red-500/10 border-b border-red-500/20 py-3 px-6 animate-in slide-in-from-top duration-500">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 text-red-400">
          <AlertTriangle size={18} />
          <p className="text-sm font-bold">Wrong Network: Please connect to Sepolia Testnet</p>
        </div>
        <button 
          onClick={switchNetwork}
          className="flex items-center gap-2 px-4 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors"
        >
          <RefreshCw size={14} />
          Switch to Sepolia
        </button>
      </div>
    </div>
  );
};

const Navigation = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path ? "text-white" : "text-text-muted hover:text-white";

  return (
    <nav className="border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-12">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <ShieldAlert size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Veilr.</span>
          </Link>
          
          <div className="flex items-center gap-6 text-sm font-medium">
            <Link 
              to="/credit" 
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                isActive('/credit') === 'text-white'
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
              }`}
            >
              <BadgeCheck size={16} />
              Private Credit
            </Link>
            <Link to="/" className={`transition-colors ${isActive('/')}`}>Dashboard</Link>
            
            <div className="h-4 w-px bg-white/10 mx-2" />
            
            <Link to="/send" className={`transition-colors flex items-center gap-2 ${isActive('/send')}`}>
              <SendIcon size={14} /> Encrypted Send
            </Link>
            
            <Link to="/compliance" className={`transition-colors flex items-center gap-2 ${isActive('/compliance')}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              Compliance
            </Link>
          </div>
        </div>

        <WalletConnect />
      </div>
    </nav>
  );
};

function App() {
  return (
    <FhevmProvider>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#1A1D23',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '1rem',
          fontSize: '0.875rem'
        }
      }} />
      <Router>
        <div className="min-h-screen flex flex-col selection:bg-primary/30">
          <NetworkBanner />
          <Navigation />
          <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/send" element={<Send />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/credit" element={<Credit />} />
            </Routes>
          </main>
        </div>
      </Router>
    </FhevmProvider>
  );
}

export default App;
