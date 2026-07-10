import React, { useState, useEffect } from "react";
import { Server, AlertCircle, HelpCircle, Eye, EyeOff, CheckCircle } from "lucide-react";

interface ConnectionConfigProps {
  apiKey: string;
  isDemoMode: boolean;
  onApiKeyChange: (key: string) => void;
  onDemoModeToggle: (isDemo: boolean) => void;
  isLoading: boolean;
  errorMsg: string | null;
}

export const ConnectionConfig: React.FC<ConnectionConfigProps> = ({
  apiKey,
  isDemoMode,
  onApiKeyChange,
  onDemoModeToggle,
  isLoading,
  errorMsg
}) => {
  const [showKey, setShowKey] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);

  const handleSubmitKey = (e: React.FormEvent) => {
    e.preventDefault();
    onApiKeyChange(tempKey.trim());
  };

  return (
    <div id="connection-config-card" className="bg-[#F3F2EE] rounded-none border-2 border-[#141414] p-5 shadow-[4px_4px_0px_0px_rgba(20,20,20,0.15)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-[#141414] pb-4">
        <h2 id="connection-title" className="text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 text-[#141414]">
          <Server className="w-4 h-4 text-[#141414]" />
          [SYSTEM_SYNCHRONIZATION]
        </h2>
        
        {/* Toggle Mode Button Selector */}
        <div className="flex bg-[#E4E3E0] border border-[#141414] p-0.5">
          <button
            id="btn-mode-demo"
            type="button"
            onClick={() => onDemoModeToggle(true)}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition-all ${
              isDemoMode
                ? "bg-[#141414] text-[#E4E3E0]"
                : "text-[#141414] hover:bg-white/40"
            }`}
          >
            Sandbox Mock
          </button>
          <button
            id="btn-mode-live"
            type="button"
            onClick={() => onDemoModeToggle(false)}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition-all ${
              !isDemoMode
                ? "bg-[#141414] text-[#E4E3E0]"
                : "text-[#141414] hover:bg-white/40"
            }`}
          >
            Live api.trak.co
          </button>
        </div>
      </div>

      {isDemoMode ? (
        <div id="demo-mode-alert" className="bg-[#D8D7D2] rounded-none p-4 text-[11px] text-[#141414] border border-[#141414] space-y-2">
          <div className="flex items-center gap-2 font-mono font-bold uppercase tracking-wider text-amber-800">
            <CheckCircle className="w-4 h-4 shrink-0 text-amber-800" />
            Active Mode: Local Preconfigured Feeds
          </div>
          <p className="leading-relaxed font-sans">
            The generator loads realistic fencing materials lists and quote metadata directly. Try entering different numbers like <strong className="font-mono">1001</strong>, <strong className="font-mono">1002</strong>, or <strong className="font-mono">1003</strong> at the top to load diverse suppliers and materials!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <form id="api-key-form" onSubmit={handleSubmitKey} className="space-y-2.5">
            <div className="flex justify-between items-center text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#141414]">
              <label htmlFor="trak-api-key-input">
                Trak Client Authorization Header (ttrak-key)
              </label>
              {apiKey ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  [CONNECTED]
                </span>
              ) : (
                <span className="text-red-700 font-bold flex items-center gap-1">
                  [MISSING KEY]
                </span>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  id="trak-api-key-input"
                  type={showKey ? "text" : "password"}
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  placeholder="ttrak-key ••••••••••"
                  className="w-full pl-3 pr-10 py-2 text-xs text-[#141414] bg-white rounded-none border border-[#141414] focus:outline-hidden font-mono placeholder:text-gray-400"
                />
                <button
                  id="btn-toggle-key-visibility"
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-black"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                id="btn-apply-key"
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-[#E4E3E0] bg-[#141414] hover:bg-gray-800 rounded-none border border-[#141414] cursor-pointer transition-all shrink-0 disabled:opacity-60 disabled:pointer-events-none"
              >
                Save
              </button>
            </div>
          </form>

          {errorMsg && (
            <div id="connection-error" className="bg-red-50 border border-red-800 rounded-none p-3 text-red-950 text-xs flex items-start gap-2 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-red-750 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold uppercase tracking-wider text-[10px] font-mono">CONNECTION RESPONSE DETAILS</p>
                <p className="text-red-850 text-[11px] font-sans">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Documentation Helper section on finding the key */}
          <div id="key-guide-info" className="bg-[#E4E3E0]/70 border border-[#141414] rounded-none p-4 space-y-2">
            <h3 className="text-[10px] uppercase font-mono font-bold text-[#141414] flex items-center gap-1.5 border-b border-[#141414]/20 pb-1">
              <HelpCircle className="w-3.5 h-3.5" />
              WHERE IS MY AUTH KEY?
            </h3>
            <ol className="list-decimal pl-4 text-[10.5px] text-[#141414]/80 space-y-1.5 leading-relaxed font-sans">
              <li>Log in to your <strong>Trak.co</strong> portal account.</li>
              <li>Navigate to <strong>Company Settings &gt; Data Management &gt; API Settings</strong>.</li>
              <li>Copy your <strong>API v2 Authorization Key</strong> and save it above.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
