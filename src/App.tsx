import React, { useState, useEffect, useCallback, FormEvent } from "react";
import { Hammer, CircleAlert, CheckCircle, Database, LayoutGrid, SlidersHorizontal, RefreshCw, Printer, Search, HelpCircle, Sparkles, FileDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { QuoteData, ConnectionConfigState } from "./types";
import { getQuoteData } from "./data/mockQuotes";
import { ConnectionConfig } from "./components/ConnectionConfig";
import { PickingSlipSheet } from "./components/PickingSlipSheet";

const FENCING_PROGRESSIONS = [
  "Counting palings...",
  "Loading transport trucks...",
  "Refilling gas nail guns...",
  "Refuelling steel estimators...",
  "Greasing track mini loaders...",
  "Digging deep post holes...",
  "Mixing bags of concrete...",
  "Stretching boundary chainlink mesh...",
  "Leveling plinth lines...",
  "Squaring metal corner posts...",
  "Tensioning wire coils...",
  "Checking string levels...",
  "Aligning laser levels...",
  "Capping matching gate posts...",
  "Calculating timber margins..."
];

// Reusing and polishing the hilarious Saint Stick Figure animation from the original code
const FenceSaintAnimation = ({ compact = false }: { compact?: boolean }) => {
  return (
    <div className={compact 
      ? "relative w-28 h-12 bg-[#eae8e3]/65 border border-[#141414] p-0.5 flex items-center justify-center overflow-hidden shadow-[1px_1px_0px_rgba(20,20,20,0.1)] shrink-0"
      : "relative w-64 h-32 mx-auto bg-[#eae8e3]/60 border-2 border-[#141414] p-2 mb-4 flex items-center justify-center overflow-hidden shadow-[2px_2px_0px_rgba(20,20,20,0.1)]"
    }>
      <svg width={compact ? "110" : "240"} height={compact ? "55" : "120"} viewBox="0 0 240 120" className="w-full h-full" id="fence-saint-svg">
        {/* Ground Line */}
        <line x1="10" y1="100" x2="230" y2="100" stroke="#141414" strokeWidth="3" strokeLinecap="round" />
        
        {/* Already built fence section */}
        {/* Post 1 */}
        <rect x="25" y="60" width="8" height="40" fill="none" stroke="#141414" strokeWidth="2" />
        {/* Post 2 */}
        <rect x="65" y="60" width="8" height="40" fill="none" stroke="#141414" strokeWidth="2" />
        {/* Rails connecting Post 1 and Post 2 */}
        <line x1="33" y1="70" x2="65" y2="70" stroke="#141414" strokeWidth="2" />
        <line x1="33" y1="90" x2="65" y2="90" stroke="#141414" strokeWidth="2" />
        {/* Palings on built section */}
        <line x1="40" y1="62" x2="40" y2="100" stroke="#141414" strokeWidth="1.5" />
        <line x1="50" y1="62" x2="50" y2="100" stroke="#141414" strokeWidth="1.5" />
        <line x1="60" y1="62" x2="60" y2="100" stroke="#141414" strokeWidth="1.5" />

        {/* The current post being worked on */}
        <motion.g
          animate={{
            y: [0, 4, 1, 3, 0],
          }}
          transition={{
            duration: 1.0,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {/* Post 3 (The one saint is mallet-ing into place) */}
          <rect x="175" y="52" width="8" height="48" fill="#D8D7D2" stroke="#141414" strokeWidth="2" />
          {/* Connecting Rails being installed - dashed indicator */}
          <line x1="73" y1="70" x2="175" y2="70" stroke="#141414" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="73" y1="90" x2="175" y2="90" stroke="#141414" strokeWidth="1.5" strokeDasharray="3,3" />
        </motion.g>

        {/* The Saint Stick Figure */}
        <g>
          {/* Animated Floating Halo */}
          <motion.ellipse
            cx="135"
            cy="18"
            rx="14"
            ry="4.5"
            fill="none"
            stroke="#141414"
            strokeWidth="2"
            animate={{
              y: [0, -3, 0],
              scale: [1, 1.08, 1],
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Head */}
          <circle cx="135" cy="34" r="9" fill="#F3F2EE" stroke="#141414" strokeWidth="2" />

          {/* Body */}
          <line x1="135" y1="43" x2="135" y2="75" stroke="#141414" strokeWidth="2" />

          {/* Left Arm (supporting or holding the post) */}
          <line x1="135" y1="51" x2="175" y2="65" stroke="#141414" strokeWidth="2" strokeLinecap="round" />

          {/* Right Arm (Swinging Hammer / Mallet) */}
          <motion.g
            style={{ transformOrigin: "135px 51px" }}
            animate={{
              rotate: [15, -45, 40, 15],
            }}
            transition={{
              duration: 1.0,
              repeat: Infinity,
              ease: "easeOut",
            }}
          >
            {/* Shoulder to elbow, elbow to hand */}
            <line x1="135" y1="51" x2="152" y2="38" stroke="#141414" strokeWidth="2" strokeLinecap="round" />
            <line x1="152" y1="38" x2="168" y2="44" stroke="#141414" strokeWidth="2" strokeLinecap="round" />
            
            {/* Mallet shaft */}
            <line x1="164" y1="35" x2="172" y2="55" stroke="#141414" strokeWidth="1.5" />
            {/* Mallet head */}
            <rect x="159" y="30" width="10" height="7" fill="#141414" rx="1" />
          </motion.g>

          {/* Legs standing stable */}
          <line x1="135" y1="75" x2="123" y2="100" stroke="#141414" strokeWidth="2" strokeLinecap="round" />
          <line x1="135" y1="75" x2="147" y2="100" stroke="#141414" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Action Sparkles timed with mallet drop */}
        <motion.circle
          cx="175"
          cy="48"
          r="4"
          fill="#F59E0B"
          animate={{
            scale: [0, 2, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1.0,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
        <motion.path
          d="M 183 44 L 191 38 M 181 54 L 189 57"
          stroke="#F59E0B"
          strokeWidth="2"
          strokeLinecap="round"
          animate={{
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1.0,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      </svg>
    </div>
  );
};

export default function App() {
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem("trak_api_key") || "";
  });

  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    const savedDemo = localStorage.getItem("trak_is_demo");
    // Default to true for sandbox experience
    return savedDemo !== null ? savedDemo === "true" : true;
  });

  const [quoteInput, setQuoteInput] = useState<string>("1001");
  const [lastLoadedQuoteInput, setLastLoadedQuoteInput] = useState<string>("1001");
  const [quoteData, setQuoteDataState] = useState<QuoteData>(() => getQuoteData("1001"));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadingPhrase, setLoadingPhrase] = useState<string>(FENCING_PROGRESSIONS[0]);
  const [isPrintPreviewMode, setIsPrintPreviewMode] = useState<boolean>(false);

  // Reset preview mode when a new load commences
  useEffect(() => {
    if (isLoading) {
      setIsPrintPreviewMode(false);
    }
  }, [isLoading]);

  // Escape key handler to exit print preview mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPrintPreviewMode) {
        setIsPrintPreviewMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPrintPreviewMode]);

  // Rotates loading phrases for the custom loading state
  useEffect(() => {
    let interval: any;
    if (isLoading) {
      let idx = 0;
      interval = setInterval(() => {
        idx = (idx + 1) % FENCING_PROGRESSIONS.length;
        setLoadingPhrase(FENCING_PROGRESSIONS[idx]);
      }, 1400);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Main quote loading/retrieval mechanism
  const loadQuote = useCallback(async (targetNo: string) => {
    const cleanedInput = targetNo.trim();
    if (!cleanedInput) return;

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Give a neat slight delay to let the lovely Fence Saint animation run
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Resolve prefixing - Quote numbers usually start with QT_
    const fullQuoteNoString = cleanedInput.startsWith("QT_") ? cleanedInput : `QT_${cleanedInput}`;

    if (isDemoMode) {
      try {
        const fetchedData = getQuoteData(cleanedInput);
        setQuoteDataState(fetchedData);
        setLastLoadedQuoteInput(cleanedInput);
        setSuccessMsg(`Successfully loaded local quote ${fullQuoteNoString} in Sandbox Mode.`);
      } catch (err: any) {
        setErrorMsg(`Failed to generate sandbox quote: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Live Mode through our Express proxy server
    try {
      const response = await fetch(`/api/quotes/${encodeURIComponent(fullQuoteNoString)}`, {
        method: "GET",
        headers: {
          "ttrak-key": apiKey,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Server returned error code ${response.status}`);
      }

      const resJson = await response.json();

      if (resJson.isFallback) {
        // Fallback indicator
        const fallbackLocal = getQuoteData(cleanedInput);
        setQuoteDataState(fallbackLocal);
        setLastLoadedQuoteInput(cleanedInput);
        setSuccessMsg(`Trak API Server returned fall-back response. Displaying mapped data for ${fullQuoteNoString}.`);
      } else {
        // Real API parsing: Let's extract values dynamically from the Trak payload structures!
        // We'll map client details, address fields, and line items.
        
        const trakQuote = Array.isArray(resJson) ? resJson[0] : resJson;
        
        if (!trakQuote) {
          throw new Error("No quote items returned from Trak API.");
        }

        // Trak API values layout mapping
        const mappedQuote: QuoteData = {
          id: trakQuote.id || Date.now(),
          quoteNumber: trakQuote.quote_number || fullQuoteNoString,
          customer: {
            name: trakQuote.client?.name || trakQuote.mainContact?.first_name || "Trak Client",
            phone: trakQuote.client?.phone_number || trakQuote.mainContact?.phone_number || "",
            email: trakQuote.client?.email || trakQuote.mainContact?.email || "",
            company: trakQuote.client?.company_name || ""
          },
          address: {
            street: trakQuote.project?.address || trakQuote.address || "Unspecified Street",
            suburb: trakQuote.project?.suburb || "",
            state: trakQuote.project?.state || "",
            postcode: trakQuote.project?.postcode || "",
            fullAddress: trakQuote.address || "Unspecified Address"
          },
          plannedWorksDate: trakQuote.start_date || trakQuote.planned_date || new Date().toISOString().split("T")[0],
          // Extract items
          items: []
        };

        const rawItems = trakQuote.items || trakQuote.lineItems || [];
        if (Array.isArray(rawItems) && rawItems.length > 0) {
          mappedQuote.items = rawItems.map((ri: any, index: number) => ({
            id: ri.id || `live_item_${index}`,
            name: ri.name || ri.description || "Infill Board / Framing",
            quantity: Number(ri.quantity || ri.qty || 1),
            unit: ri.unit || "pcs",
            supplier: ri.supplier_name || ri.supplier || "Fencing Depot",
            notes: ri.notes || ri.comment || ""
          }));
        } else {
          // Fallback items if live quote is empty so the sheet isn't totally blank
          const localFallback = getQuoteData(cleanedInput);
          mappedQuote.items = localFallback.items;
        }

        setQuoteDataState(mappedQuote);
        setLastLoadedQuoteInput(cleanedInput);
        setSuccessMsg(`Successfully retrieved quote ${fullQuoteNoString} live from TradeTrak API.`);
      }

    } catch (err: any) {
      console.warn("Live api sync failed, loading sandbox placeholder data mapping:", err.message);
      
      // Fallback with visual warning notice
      const fallbackLocal = getQuoteData(cleanedInput);
      setQuoteDataState(fallbackLocal);
      setLastLoadedQuoteInput(cleanedInput);
      setErrorMsg(`Live Trak sync failed: ${err.message}. Showing local repository placeholder data securely mapped.`);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, isDemoMode]);

  // Load default quote on mount
  useEffect(() => {
    loadQuote("1001");
  }, []);

  const handleApiKeyChange = (newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem("trak_api_key", newKey);
  };

  const handleDemoModeToggle = (isDemo: boolean) => {
    setIsDemoMode(isDemo);
    localStorage.setItem("trak_is_demo", String(isDemo));
    setSuccessMsg(`Switched environment mode successfully.`);
  };

  const handleQuoteNoSubmit = (e: FormEvent) => {
    e.preventDefault();
    loadQuote(quoteInput);
  };

  // Human-readable date formatting utility
  const formattedDate = (dateStr: string) => {
    if (!dateStr) return "Not Scheduled";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-AU", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  if (isPrintPreviewMode) {
    return (
      <div 
        onClick={() => setIsPrintPreviewMode(false)}
        className="min-h-screen bg-[#fafafa] text-[#141414] font-sans antialiased flex flex-col items-center justify-start overflow-y-auto py-12 px-4 cursor-zoom-out select-none"
        title="Click background or press Escape to close print preview"
      >
        <div 
          onClick={(e) => e.stopPropagation()} 
          className="max-w-[210mm] w-full cursor-default print:w-auto print:p-0 select-text"
        >
          <PickingSlipSheet 
            quote={quoteData}
            formattedDate={formattedDate}
            isPrintPreviewMode={isPrintPreviewMode}
            onTogglePreview={() => setIsPrintPreviewMode(!isPrintPreviewMode)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EAE8E3] text-[#141414] font-sans antialiased flex flex-col pt-20">
      
      {/* 
        STICKY HEADER WRAPPER
        This bar stays locked at the top of the viewport when scrolling,
        as requested: "at the top of the page, in header that does not move when scrolling"
      */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-[#F3F2EE] border-b-4 border-[#141414] px-4 md:px-8 flex items-center justify-between z-50 select-none shadow-[0px_2px_4px_rgba(20,20,20,0.05)]">
        <div className="flex items-center gap-3">
          <img 
            src="https://trade-trak-user-uploads.s3.ap-southeast-2.amazonaws.com/company/logo/0b0e820b8741632d2e12acd09f28b827.jpg" 
            alt="Fencing Around Logo" 
            className="w-12 h-12 border-2 border-[#141414] object-contain p-0.5"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="text-sm md:text-base font-extrabold uppercase tracking-tight font-sans text-gray-900 leading-none">
              Fencing Around Picking Slip Generator
            </h1>
            <p className="text-[10px] font-mono font-bold text-gray-550 uppercase tracking-widest mt-0.5 hidden sm:block">
              INTEGRATED WORKPLACE SUITE [V4.2]
            </p>
          </div>
        </div>

        {/* Quote input field with the text prefix "QT_" before input */}
        <form onSubmit={handleQuoteNoSubmit} className="flex items-center gap-1.5 md:gap-2">
          <div className="flex items-center bg-white border-2 border-[#141414] px-2.5 py-1.5 shadow-[1px_1px_0px_rgba(20,20,20,0.15)] font-mono text-xs md:text-sm font-bold text-[#141414]">
            <span className="text-[#141414]/60 mr-1 shrink-0">QT_</span>
            <input
              type="text"
              value={quoteInput}
              onChange={(e) => setQuoteInput(e.target.value)}
              placeholder="e.g. 1001"
              disabled={isLoading}
              className="w-16 sm:w-24 bg-transparent outline-hidden font-black border-none p-0 text-[#141414]"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !quoteInput.trim()}
            className="bg-[#141414] hover:bg-gray-800 text-white font-mono text-xs font-bold uppercase tracking-widest py-2 px-3.5 border-2 border-[#141414] cursor-pointer transition-all active:translate-y-[0.5px] disabled:opacity-50 flex items-center gap-1 shadow-[1px_1px_0px_rgba(20,20,20,0.1)] shrink-0"
          >
            {isLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Load</span>
          </button>
        </form>
      </header>

      {/* WORKSPACE AREA with left menu/control column and main output on the right */}
      <div className="max-w-7xl w-full mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: System info and connections controls */}
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-28 print:hidden select-none">
          
          {/* Active status indicator card */}
          <div className="bg-[#D8D7D2]/45 border-2 border-[#141414] p-4 font-mono text-xs space-y-2">
            <h3 className="font-bold uppercase tracking-wider text-[10px] text-gray-700">WORKSPACE METRIC STATUS</h3>
            <div className="flex items-center justify-between">
              <span>ACTIVE DOC REF:</span>
              <span className="font-bold underline text-[#141414]">QT_{lastLoadedQuoteInput}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>ITEMS DETECTED:</span>
              <span className="font-bold text-[#141414]">{quoteData?.items?.length || 0} ITEMS</span>
            </div>
            <div className="flex items-center justify-between">
              <span>UNIQUE SUPPLIERS:</span>
              <span className="font-bold text-[#141414]">
                {new Set(quoteData?.items?.map(i => i.supplier || "General Supplies")).size} SUPPLIERS
              </span>
            </div>
          </div>

          {/* Quick Demo Selector */}
          <div className="bg-[#F3F2EE] rounded-none border-2 border-[#141414] p-5 shadow-[4px_4px_0px_0px_rgba(20,20,20,0.15)] space-y-4">
            <div>
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-black flex items-center gap-1.5 pb-2 border-b border-[#141414]/25">
                <Sparkles className="w-3.5 h-3.5" />
                QUICK SANDBOX SELECTOR:
              </h3>
              <p className="text-[11px] text-gray-650 mt-1.5 leading-relaxed font-sans">
                Choose one of our preloaded fence job quotes below for immediate material test rendering:
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["1001", "1002", "1003"].map((no) => {
                const isActive = lastLoadedQuoteInput === no;
                return (
                  <button
                    key={no}
                    type="button"
                    onClick={() => {
                      setQuoteInput(no);
                      loadQuote(no);
                    }}
                    disabled={isLoading}
                    className={`text-xs py-2 font-mono font-bold border transition-all ${
                      isActive 
                        ? "bg-[#141414] text-[#E4E3E0] border-[#141414] shadow-xs" 
                        : "bg-white hover:bg-gray-100/80 text-black border-gray-450 active:translate-y-[0.5px]"
                    }`}
                  >
                    QT_{no}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Authentication System Panel */}
          <ConnectionConfig
            apiKey={apiKey}
            isDemoMode={isDemoMode}
            onApiKeyChange={handleApiKeyChange}
            onDemoModeToggle={handleDemoModeToggle}
            isLoading={isLoading}
            errorMsg={errorMsg}
          />

          {/* Tips block */}
          <div className="bg-[#141414] text-white p-4 space-y-2">
            <h4 className="text-[10.5px] font-mono font-black tracking-widest flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              PRINT TIP
            </h4>
            <p className="text-[11px] leading-relaxed text-[#D8D7D2] font-sans">
              To output a perfect clean physical copy, click on <strong className="text-white">Print Picking Slip</strong> below the document sheet. The browser layout, menus, sidebars, and input buttons are automatically removed from printed output!
            </p>
          </div>
        </aside>

        {/* RIGHT COLUMN: Picking Slip document itself */}
        <main className="col-span-1 lg:col-span-8 space-y-6">
          
          {/* Global Event Alerts (Toast style notifications) */}
          <AnimatePresence>
            {(successMsg || errorMsg) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="print:hidden rounded-none border-2 border-black p-4 bg-white shadow-[2px_2px_0px_rgba(20,20,20,0.1)] flex items-start gap-2.5 font-mono text-xs"
              >
                {errorMsg ? (
                  <CircleAlert className="w-4.5 h-4.5 text-red-700 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-700 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <span className="font-extrabold block mb-0.5 text-[#141414]">
                    {errorMsg ? "[SYSTEM WARNING]" : "[TRANSACTION METRIC SUCCESS]"}
                  </span>
                  <p className="text-[11px] font-sans text-gray-700">{errorMsg || successMsg}</p>
                </div>
                <button 
                  onClick={() => { setErrorMsg(null); setSuccessMsg(null); }}
                  className="text-[10px] uppercase font-black tracking-wider text-black hover:underline pl-2 select-none"
                >
                  Dismiss
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Document Section */}
          <div className="relative">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading-frame"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-white text-[#141414] border-2 border-[#141414] p-12 text-center flex flex-col items-center justify-center min-h-[500px] shadow-[4px_4px_0px_rgba(20,20,20,0.15)] select-none"
                >
                  {/* Rotating Saint figure MALLET mallet-ing post */}
                  <FenceSaintAnimation />
                  <p className="font-mono text-xs font-black uppercase tracking-wider animate-pulse mt-4">
                    {loadingPhrase}
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono mt-2">
                    Retrieving quote record for QT_{quoteInput}...
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key={quoteData?.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Generated A4 printable Picking Slip template */}
                  <PickingSlipSheet 
                    quote={quoteData}
                    formattedDate={formattedDate}
                    isPrintPreviewMode={isPrintPreviewMode}
                    onTogglePreview={() => setIsPrintPreviewMode(!isPrintPreviewMode)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
