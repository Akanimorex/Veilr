import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FhevmProvider } from './hooks/useFhevm';
import { Toaster } from 'react-hot-toast';
import { WalletConnect } from './components/WalletConnect';
import { Dashboard } from './pages/Dashboard';
import { Send } from './pages/Send';
import { Compliance } from './pages/Compliance';
import { Credit } from './pages/Credit';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useFhevm } from './hooks/useFhevm';

const NetworkBanner = () => {
  const { isWrongNetwork, switchNetwork, account } = useFhevm();
  if (!account || !isWrongNetwork) return null;
  return (
    <div className="border-b border-red-500/10 bg-red-500/5 py-2.5 px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-red-400">
          <AlertTriangle size={14} strokeWidth={2.5} />
          <p className="text-xs font-medium">Connected to wrong network. Veilr requires Sepolia Testnet.</p>
        </div>
        <button
          onClick={switchNetwork}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md text-xs font-semibold transition-colors border border-red-500/20"
        >
          <RefreshCw size={12} />
          Switch Network
        </button>
      </div>
    </div>
  );
};

const Navigation = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="border-b border-white/[0.06] bg-background/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="h-6 w-6 rounded-md bg-primary/15 border border-primary/20 flex items-center justify-center">
              <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">Veilr</span>
            <span className="text-[10px] font-bold text-text-muted/60 uppercase tracking-widest border border-white/10 rounded px-1.5 py-0.5">Sepolia</span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {[
              { path: '/', label: 'Dashboard' },
              { path: '/credit', label: 'Credit' },
              { path: '/send', label: 'Send' },
              { path: '/compliance', label: 'Compliance' },
            ].map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors font-medium ${
                  isActive(path)
                    ? 'text-white bg-white/[0.06]'
                    : 'text-text-muted hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {label}
              </Link>
            ))}
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
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#18181b',
            color: '#fafafa',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            fontSize: '0.8125rem',
            fontFamily: 'Inter, sans-serif',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          },
          success: {
            iconTheme: { primary: '#a78bfa', secondary: '#18181b' },
          },
        }}
      />
      <Router>
        <div className="min-h-screen flex flex-col">
          <NetworkBanner />
          <Navigation />
          <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
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
