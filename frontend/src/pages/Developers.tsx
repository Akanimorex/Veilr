import { useState } from 'react';
import { 
  Code2, 
  Copy, 
  ExternalLink, 
  Download, 
  Check, 
  Shield, 
  Cpu, 
  Terminal 
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export const Developers = () => {
  const [copied, setCopied] = useState(false);
  const CONTRACT_ADDRESS = "0xd667A750C3dba0436eBd47dC5a57B6D7BA49045e";

  const handleCopy = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    toast.success("Address copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadInterface = () => {
    const content = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint8} from "@fhevm/solidity/lib/FHE.sol";

interface IVeilrCredit {
    function hasCreditScore(address borrower) external view returns (bool);
    function requestCreditTier(address borrower, address lender) external returns (euint8);
}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'IVeilrCredit.sol';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Interface file downloaded");
  };

  const integrationCode = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IVeilrCredit.sol";
import "@fhevm/solidity/lib/FHE.sol";

contract YourLendingProtocol {
    IVeilrCredit public veilr;

    constructor(address _veilr) {
        veilr = IVeilrCredit(_veilr);
    }

    function checkEligibility(address borrower) external {
        require(veilr.hasCreditScore(borrower), "No Veilr score");
        
        // One-line integration: Request encrypted tier
        // This grants your contract permission to use the handle
        euint8 tier = veilr.requestCreditTier(borrower, address(this));
        
        // Compute privately on the tier (logic stays encrypted!)
        // e.g. Check if tier is 1 (Highest Reputation)
        ebool isHighTier = FHE.eq(tier, uint8(1));
        
        // Proceed with your protocol logic...
    }
}`;

  return (
    <div className="space-y-12 pb-20 animate-fade-in">
      {/* Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold tracking-widest uppercase">
          <Terminal size={12} />
          Developer Portal
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Build on Privacy</h1>
        <p className="text-text-muted max-w-2xl leading-relaxed">
          Integrate institutional-grade private credit scoring into your dApp. 
          Veilr provides a simple, permissionless API to access encrypted reputation signals.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Col: Contract & Download */}
        <div className="lg:col-span-1 space-y-6">
          {/* Main Contract */}
          <div className="p-6 rounded-2xl bg-surface border border-white/[0.06] space-y-4 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Shield size={60} />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Main Infrastructure</h3>
            <div className="space-y-2">
              <p className="text-[11px] text-text-muted font-medium">Veilr Contract (Sepolia)</p>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-background border border-white/[0.04]">
                <code className="text-xs text-primary font-mono truncate">
                  {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)}
                </code>
                <button 
                  onClick={handleCopy}
                  className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors text-text-muted hover:text-white"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <a 
              href={`https://explorer.zama.ai/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-xs font-semibold text-text-muted hover:text-primary transition-colors pt-2"
            >
              View on Explorer
              <ExternalLink size={14} />
            </a>
          </div>

          {/* Interface Download */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/20 space-y-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Download size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Veilr SDK Interface</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Download the IVeilrCredit.sol interface to start building your integration.
              </p>
            </div>
            <button 
              onClick={downloadInterface}
              className="w-full py-3 bg-primary text-background font-bold rounded-xl hover:bg-primary-hover transition-all flex items-center justify-center gap-2 text-sm shadow-[0_0_20px_rgba(167,139,250,0.2)]"
            >
              Download Interface
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Right Col: Code Snippet */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
             <div className="flex items-center gap-2">
                <Code2 size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Integration Example</h3>
             </div>
             <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
                </div>
             </div>
          </div>
          
          <div className="rounded-2xl bg-[#0d0d0f] border border-white/[0.08] p-1 overflow-hidden shadow-2xl relative">
            <div className="absolute top-4 right-4 z-10">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(integrationCode);
                    toast.success("Code snippet copied");
                  }}
                  className="p-2 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] rounded-lg text-text-muted hover:text-white transition-all backdrop-blur-md"
                >
                  <Copy size={14} />
                </button>
            </div>
            <pre className="p-6 overflow-x-auto text-[13px] leading-relaxed font-mono text-text-muted custom-scrollbar max-h-[500px]">
              <code className="language-solidity">
                {integrationCode.split('\n').map((line, i) => {
                  // Basic syntax highlighting colors
                  let color = 'text-text-muted';
                  if (line.trim().startsWith('//')) color = 'text-zinc-600 italic';
                  else if (line.includes('contract') || line.includes('function') || line.includes('interface')) color = 'text-primary';
                  else if (line.includes('require') || line.includes('import')) color = 'text-emerald-400';
                  else if (line.includes('uint') || line.includes('address') || line.includes('bool') || line.includes('euint8')) color = 'text-blue-400';
                  else if (line.includes('"')) color = 'text-orange-300';
                  
                  return (
                    <div key={i} className="flex gap-4 group hover:bg-white/[0.02] -mx-6 px-6 transition-colors">
                      <span className="w-4 text-zinc-800 text-right shrink-0 select-none">{i + 1}</span>
                      <span className={color}>{line || ' '}</span>
                    </div>
                  );
                })}
              </code>
            </pre>
          </div>
          
          <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-blue-400/80">
            <Cpu size={16} />
            <p className="text-[11px] font-medium leading-relaxed">
              <strong>Tip:</strong> Ensure you are using a Cancun-enabled EVM environment and have the <code>@fhevm/solidity</code> library installed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
