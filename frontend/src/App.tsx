import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FhevmProvider } from './hooks/useFhevm';
import { WalletConnect } from './components/WalletConnect';
import { Dashboard } from './pages/Dashboard';
import { Send } from './pages/Send';
import { Compliance } from './pages/Compliance';
import { Credit } from './pages/Credit';
import { ShieldAlert, BadgeCheck } from 'lucide-react';

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
            {/* Credit Score is the hero feature — visually prominent */}
            <Link 
              to="/credit" 
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                isActive('/credit') === 'text-white'
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
              }`}
            >
              <BadgeCheck size={16} />
              Credit Score
            </Link>
            <Link to="/" className={`transition-colors ${isActive('/')}`}>Dashboard</Link>
            <Link to="/send" className={`transition-colors ${isActive('/send')}`}>Send</Link>
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
      <Router>
        <div className="min-h-screen flex flex-col selection:bg-primary/30">
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
