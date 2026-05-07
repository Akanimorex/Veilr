import { Link } from 'react-router-dom';
import { useFhevm } from '../hooks/useFhevm';
import { 
  Shield, 
  Lock, 
  TrendingUp, 
  Zap, 
  EyeOff, 
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

export const Landing = () => {
  const { connect, account, isConnecting } = useFhevm();

  return (
    <div className="flex flex-col min-h-screen -mt-10 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 lg:pt-40 lg:pb-56 overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-8 animate-fade-in">
            <Zap size={12} className="fill-primary" />
            <span>POWERED BY ZAMA FHEVM</span>
          </div>
          
          <h1 className="text-6xl lg:text-8xl font-extrabold tracking-tight text-white mb-8 leading-[1.05] animate-fade-in-up">
            The Private <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-hover">Reputation Layer</span>
          </h1>
          
          <p className="text-xl text-text-muted mb-12 leading-relaxed max-w-2xl animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Prove your creditworthiness without revealing a single transaction. 
            Veilr leverages Fully Homomorphic Encryption to bring institutional-grade 
            privacy to decentralized finance.
          </p>
          
          <div className="flex flex-wrap justify-center gap-5 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            {account ? (
              <Link 
                to="/dashboard" 
                className="px-10 py-5 bg-primary text-background font-bold rounded-2xl hover:bg-primary-hover transition-all flex items-center gap-2 group shadow-[0_0_30px_rgba(167,139,250,0.3)]"
              >
                Launch Application
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <button 
                onClick={connect}
                disabled={isConnecting}
                className="px-10 py-5 bg-primary text-background font-bold rounded-2xl hover:bg-primary-hover transition-all flex items-center gap-2 group disabled:opacity-50 shadow-[0_0_30px_rgba(167,139,250,0.3)]"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            )}
            <a 
              href="#features" 
              className="px-10 py-5 bg-white/[0.04] text-white font-bold rounded-2xl border border-white/[0.08] hover:bg-white/[0.08] transition-all backdrop-blur-sm"
            >
              Explore Protocol
            </a>
          </div>

          <div className="mt-20 flex items-center gap-12 border-t border-white/[0.06] pt-12 animate-fade-in-up w-full justify-center" style={{ animationDelay: '0.6s' }}>
            <div>
              <div className="text-3xl font-bold text-white">100%</div>
              <div className="text-xs text-text-muted uppercase tracking-widest font-bold mt-1">Private Signals</div>
            </div>
            <div className="w-px h-10 bg-white/[0.06]" />
            <div>
              <div className="text-3xl font-bold text-white">TFHE</div>
              <div className="text-xs text-text-muted uppercase tracking-widest font-bold mt-1">Encryption</div>
            </div>
            <div className="w-px h-10 bg-white/[0.06]" />
            <div>
              <div className="text-3xl font-bold text-white">Sepolia</div>
              <div className="text-xs text-text-muted uppercase tracking-widest font-bold mt-1">Live Network</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 border-t border-white/[0.06]">
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">The Pillars of Sovereignty</h2>
          <p className="text-text-muted max-w-xl">
            Veilr provides the essential infrastructure for private financial interaction on-chain.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 animate-fade-in-up">
          <FeatureCard 
            icon={<TrendingUp className="text-primary" />}
            title="Private Credit Scoring"
            description="Generate a verifiable financial tier (1, 2, or 3) without revealing raw balances or activity. Perfect for undercollateralized lending."
          />
          <FeatureCard 
            icon={<EyeOff className="text-primary" />}
            title="Encrypted Remittance"
            description="Amounts and recipient identities remain completely encrypted. Prevent tracking while maintaining transparency of execution."
          />
          <FeatureCard 
            icon={<Shield className="text-primary" />}
            title="Threshold Compliance"
            description="A multi-sig auditing layer that allows regulators to decrypt specific signals only when authorized by M-of-N officers."
          />
        </div>
      </section>

      {/* Proof of FHE Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] bg-primary/5 blur-[120px] rounded-full" />
        
        <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-bold text-white mb-6 leading-tight">
              Math is the New <br />
              <span className="text-primary">Trusted Third Party</span>
            </h2>
            <div className="space-y-6">
              <StatPoint 
                title="Zero Decryption Leakage"
                desc="Smart contracts perform logic on ciphertexts. Data is never decrypted during evaluation."
              />
              <StatPoint 
                title="TFHE Standard"
                desc="Utilizing Threshold Fully Homomorphic Encryption for industrial-grade security and speed."
              />
              <StatPoint 
                title="On-chain Verification"
                desc="Every reputation signal is cryptographically verifiable and anchored to the blockchain."
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4 pt-8">
              <InfoBlock title="Security" icon={<Lock size={16} />} color="bg-blue-500/10 text-blue-400" />
              <InfoBlock title="Scalability" icon={<Zap size={16} />} color="bg-orange-500/10 text-orange-400" />
            </div>
            <div className="space-y-4">
              <InfoBlock title="Privacy" icon={<EyeOff size={16} />} color="bg-primary/10 text-primary" />
              <InfoBlock title="Compliance" icon={<Shield size={16} />} color="bg-emerald-500/10 text-emerald-400" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 mb-12">
        <div className="rounded-3xl bg-gradient-to-br from-surface to-background border border-white/[0.08] p-12 lg:p-20 text-center relative overflow-hidden group glass">
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">Ready to claim your reputation?</h2>
          <p className="text-text-muted text-lg mb-10 max-w-xl mx-auto">
            Join the private financial revolution. Connect your wallet and generate your first encrypted credit score.
          </p>
          <div className="flex justify-center gap-4">
            <Link 
              to="/dashboard" 
              className="px-10 py-4 bg-primary text-background font-bold rounded-xl hover:bg-primary-hover transition-all shadow-[0_0_20px_rgba(167,139,250,0.3)]"
            >
              Start Building
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/[0.06] flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center">
          <img src="/assets/logo-full.png" alt="Veilr" className="h-10 w-auto opacity-80 hover:opacity-100 transition-opacity" />
        </div>
        
        <div className="flex gap-8">
          <Link to="/developers" className="text-xs font-medium text-text-muted hover:text-white transition-colors">Developer Portal</Link>
          <a href="#" className="text-xs font-medium text-text-muted hover:text-white transition-colors">Zama</a>
          <a href="#" className="text-xs font-medium text-text-muted hover:text-white transition-colors">Twitter</a>
        </div>
        
        <div className="text-xs text-text-muted">
          © 2026 Veilr Protocol. Built for the privacy-centric future.
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="p-8 rounded-2xl border border-white/[0.06] bg-surface/30 hover:bg-surface/50 transition-all hover:border-white/[0.12] group">
    <div className="h-12 w-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
    <p className="text-sm text-text-muted leading-relaxed">
      {description}
    </p>
  </div>
);

const StatPoint = ({ title, desc }: { title: string, desc: string }) => (
  <div className="flex gap-4">
    <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
      <CheckCircle2 size={12} className="text-primary" />
    </div>
    <div>
      <h4 className="text-sm font-bold text-white mb-1">{title}</h4>
      <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
    </div>
  </div>
);

const InfoBlock = ({ title, icon, color }: { title: string, icon: React.ReactNode, color: string }) => (
  <div className={`p-6 rounded-2xl border border-white/[0.06] flex flex-col items-center justify-center gap-3 ${color}`}>
    {icon}
    <span className="text-xs font-bold uppercase tracking-widest">{title}</span>
  </div>
);
