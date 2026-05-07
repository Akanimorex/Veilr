import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FhevmProvider } from './hooks/useFhevm';
import { Toaster } from 'react-hot-toast';
import { WalletConnect } from './components/WalletConnect';
import { Logo } from './components/Logo';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Send } from './pages/Send';
import { Compliance } from './pages/Compliance';
import { Credit } from './pages/Credit';
import { Developers } from './pages/Developers';
import { AlertTriangle, RefreshCw, LayoutDashboard, CreditCard, Send as SendIcon, ShieldCheck, Code } from 'lucide-react';
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
  const { account } = useFhevm();
  const isActive = (path: string) => location.pathname === path;
  
  const isLanding = location.pathname === '/';

  return (
    <nav className={`border-b border-white/[0.06] bg-background/80 backdrop-blur-xl sticky top-0 z-50 ${isLanding ? 'py-2' : ''}`}>
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center group">
            <Logo size="md" className="opacity-95 group-hover:opacity-100 transition-opacity" />
          </Link>

          {/* Nav Links - Only show if not on landing or if connected */}
          {!isLanding && (
            <div className="flex items-center gap-1">
              {[
                { path: '/dashboard', label: 'Overview', icon: <LayoutDashboard size={14} /> },
                { path: '/credit', label: 'Credit', icon: <CreditCard size={14} /> },
                { path: '/send', label: 'Send', icon: <SendIcon size={14} /> },
                { path: '/compliance', label: 'Audit', icon: <ShieldCheck size={14} /> },
                { path: '/developers', label: 'Build', icon: <Code size={14} /> },
              ].map(({ path, label, icon }) => (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors font-semibold ${
                    isActive(path)
                      ? 'text-white bg-white/[0.06]'
                      : 'text-text-muted hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {icon}
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
            {isLanding && account && (
                <Link to="/dashboard" className="text-xs font-bold text-primary hover:text-primary-hover transition-colors">
                    Go to App
                </Link>
            )}
            <WalletConnect />
        </div>
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
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/send" element={<Send />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/credit" element={<Credit />} />
              <Route path="/developers" element={<Developers />} />
            </Routes>
          </main>
        </div>
      </Router>
    </FhevmProvider>
  );
}

export default App;
