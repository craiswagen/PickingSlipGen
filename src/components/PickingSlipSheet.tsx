import React, { useState, useEffect } from "react";
import { QuoteData, QuoteItem } from "../types";
import { Check, Square, CheckSquare, Calendar, User, MapPin, Layers, Printer, Sparkles, FileDown, Loader2, Eye, EyeOff } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

interface PickingSlipSheetProps {
  quote: QuoteData;
  formattedDate: (dateStr: string) => string;
  isPrintPreviewMode?: boolean;
  onTogglePreview?: () => void;
}

export const PickingSlipSheet: React.FC<PickingSlipSheetProps> = ({ 
  quote, 
  formattedDate,
  isPrintPreviewMode = false,
  onTogglePreview
}) => {
  // Save customPicked values so users can check off items on the digital screen
  const [pickedItems, setPickedItems] = useState<Record<string, boolean>>({});
  const [pickedCounts, setPickedCounts] = useState<Record<string, number>>({});

  const [isInIframe, setIsInIframe] = useState(false);
  const [showPrintHint, setShowPrintHint] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  // Reset checked states when quote ID changes
  useEffect(() => {
    setPickedItems({});
    const initialCounts: Record<string, number> = {};
    quote.items.forEach((item) => {
      initialCounts[item.id] = item.quantity; // default to fully picked for easy digital adjustments
    });
    setPickedCounts(initialCounts);
  }, [quote.id, quote.items]);

  const toggleItemCheck = (id: string | number) => {
    setPickedItems((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handlePrint = () => {
    // Attempt standard print
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.warn("Standard window.print() failed or was blocked inside sandbox:", e);
    }
    
    // If inside iframe, show the helpful popout instructions info box
    if (isInIframe) {
      setShowPrintHint(true);
    }
  };

  const handleGeneratePdf = async () => {
    const pageElements = document.querySelectorAll(".picking-slip-page");
    if (!pageElements.length) return;

    setIsGeneratingPdf(true);
    setIsExportingPdf(true);
    setShowPrintHint(false);

    // Minor wait for state toggle to cycle React layout matching to printer elements
    await new Promise((r) => setTimeout(r, 180));

    // Helper to search and replace unsupported 'oklch' styles which crash html2canvas
    const sanitizeStylesheets = async () => {
      const styleElements = Array.from(document.querySelectorAll("style"));
      const linkElements = Array.from(document.querySelectorAll("link[rel='stylesheet']")) as HTMLLinkElement[];

      const restored: Array<
        | { type: "style"; element: HTMLStyleElement; originalText: string }
        | { type: "link"; element: HTMLLinkElement; tempStyle?: HTMLStyleElement }
      > = [];

      // 1. Sanitize standard <style> tags
      for (const style of styleElements) {
        const text = style.textContent || "";
        if (text.includes("oklch")) {
          restored.push({ type: "style", element: style, originalText: text });
          style.textContent = text.replace(/oklch\([^)]+\)/g, "rgb(80, 80, 80)");
        }
      }

      // 2. Sanitize <link> tag stylesheets
      for (const link of linkElements) {
        try {
          const sheet = link.sheet;
          if (sheet) {
            let hasOklch = false;
            let cssText = "";
            
            try {
              const rules = Array.from(sheet.cssRules || []);
              for (const rule of rules) {
                cssText += rule.cssText + "\n";
                if (rule.cssText.includes("oklch")) {
                  hasOklch = true;
                }
              }
            } catch {
              hasOklch = true;
            }

            if (hasOklch) {
              if (!cssText && link.href) {
                try {
                  const resp = await fetch(link.href);
                  cssText = await resp.text();
                } catch (e) {
                  console.warn("Failed fetching link stylesheet for fallback:", e);
                }
              }

              if (cssText && cssText.includes("oklch")) {
                const sanitizedText = cssText.replace(/oklch\([^)]+\)/g, "rgb(80, 80, 80)");
                const tempStyle = document.createElement("style");
                tempStyle.textContent = sanitizedText;
                document.head.appendChild(tempStyle);

                link.disabled = true;
                restored.push({ type: "link", element: link, tempStyle });
              }
            }
          }
        } catch (err) {
          console.warn("Could not pre-process stylesheet for pdf config: ", err);
        }
      }

      return () => {
        for (const item of restored) {
          if (item.type === "style") {
            item.element.textContent = item.originalText;
          } else if (item.type === "link") {
            item.element.disabled = false;
            if (item.tempStyle) {
              item.tempStyle.remove();
            }
          }
        }
      };
    };

    const restoreStyles = await sanitizeStylesheets();

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      for (let i = 0; i < pageElements.length; i++) {
        if (i > 0) {
          pdf.addPage();
        }

        const pageEl = pageElements[i] as HTMLElement;
        const canvas = await html2canvas(pageEl, {
          scale: 2, // High DPI support for prints
          useCORS: true, // Crucial for fetching company logo across domain
          allowTaint: true,
          backgroundColor: "#ffffff",
          ignoreElements: (el) => {
            return el.classList.contains("print:hidden") || el.tagName === "BUTTON";
          }
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }

      pdf.save(`Picking_Slip_${quote.quoteNumber}.pdf`);
    } catch (err: any) {
      console.error("PDF engine crash, calling printer fallback:", err);
      handlePrint();
    } finally {
      restoreStyles();
      setIsGeneratingPdf(false);
      setIsExportingPdf(false);
    }
  };

  const handleCountChange = (id: string | number, maxVal: number, valStr: string) => {
    const num = parseInt(valStr, 10);
    setPickedCounts((prev) => ({
      ...prev,
      [id]: isNaN(num) ? 0 : Math.max(0, Math.min(maxVal, num))
    }));
  };

  // Group items or split them into chunks
  const getPagesData = (items: QuoteItem[]) => {
    // If we have 5 or fewer items, they comfortably fit onto a single page without breaking or overflow
    if (items.length <= 5) {
      return [items];
    }
    const pages: QuoteItem[][] = [];
    let currentIdx = 0;
    
    // Page 1 gets 4 items due to large corporate layout and customer info header
    pages.push(items.slice(0, 4));
    currentIdx = 4;
    
    // Subsequent pages get up to 7 items each
    while (currentIdx < items.length) {
      pages.push(items.slice(currentIdx, currentIdx + 7));
      currentIdx += 7;
    }
    
    return pages;
  };

  const pagesData = getPagesData(quote.items);

  return (
    <div className="space-y-6">
      {/* Printable Sheet Wrapper */}
      <div 
        id="picking-slip-document" 
        className="space-y-6 print:space-y-0 print:bg-white"
      >
        {pagesData.map((pageItems, pageIdx) => {
          const isFirstPage = pageIdx === 0;
          const isLastPage = pageIdx === pagesData.length - 1;
          
          // Group pageItems by supplier
          const pageGroupedBySupplier: Record<string, QuoteItem[]> = {};
          pageItems.forEach((item) => {
            const s = item.supplier || "General Supplies";
            if (!pageGroupedBySupplier[s]) {
              pageGroupedBySupplier[s] = [];
            }
            pageGroupedBySupplier[s].push(item);
          });
          const pageSuppliers = Object.keys(pageGroupedBySupplier);

          return (
            <div
              key={pageIdx}
              className={`picking-slip-page bg-white text-gray-900 p-8 sm:p-12 border border-black/15 print:border-none print:shadow-none print:p-0 mx-auto max-w-[210mm] min-h-[297mm] flex flex-col justify-between font-sans leading-relaxed transition-all duration-300 ${
                isPrintPreviewMode ? "shadow-[0_25px_60px_-15px_rgba(0,0,0,0.55)] border-none" : "border-2 border-black shadow-[4px_4px_0px_rgba(20,20,20,0.1)]"
              }`}
            >
              <div>
                {isFirstPage ? (
                  <>
                    {/* Main Doc Header (Inside printed slip) */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-black pb-6 gap-4">
                      <div className="flex items-center gap-4">
                        <img 
                          src="https://trade-trak-user-uploads.s3.ap-southeast-2.amazonaws.com/company/logo/0b0e820b8741632d2e12acd09f28b827.jpg" 
                          alt="Fencing Around Logo" 
                          className="w-16 h-16 border-2 border-black object-contain p-1 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h1 className="text-xl font-bold uppercase tracking-tight font-sans">Fencing Around</h1>
                          <p className="text-xs font-mono text-gray-600">PREMIUM FENCING CONTRACTORS</p>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">ABN: 42 165 921 521 | Sales & Service</p>
                        </div>
                      </div>
                      
                      <div className="text-right sm:text-right w-full sm:w-auto flex flex-col items-end">
                        <span className="bg-[#141414] text-white text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 mb-1">
                          PICKING SLIP
                        </span>
                        <p className="text-xl font-mono font-extrabold text-[#141414]">
                          {quote.quoteNumber}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono">
                          System Reference ID: #{quote.id}
                        </p>
                      </div>
                    </div>

                    {/* Customer & Delivery Address details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6 border-b border-black/15 pb-6">
                      <div className="space-y-2">
                        <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-black/55 flex items-center gap-1.5 leading-none">
                          <User className="w-3.5 h-3.5" />
                          CUSTOMER INFORMATION
                        </h3>
                        <div className="p-4 bg-[#F9F9FA] border border-black/10 rounded-sm">
                          <p className="font-bold text-base text-gray-900 leading-tight">
                            {quote.customer.name}
                          </p>
                          {quote.customer.company && (
                            <p className="text-xs font-medium text-gray-700 mt-0.5 italic">
                              {quote.customer.company}
                            </p>
                          )}
                          <div className="mt-2.5 space-y-0.5 text-xs font-mono text-gray-650">
                            {quote.customer.phone && <p>📞 Phone: {quote.customer.phone}</p>}
                            {quote.customer.email && <p>✉️ Email: {quote.customer.email}</p>}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-black/55 flex items-center gap-1.5 leading-none">
                          <MapPin className="w-3.5 h-3.5" />
                          DELIVERY / SITE ADDRESS
                        </h3>
                        <div className="p-4 bg-[#F9F9FA] border border-black/10 rounded-sm font-sans">
                          <p className="font-semibold text-sm text-gray-800 leading-snug">
                            {quote.address.street}
                          </p>
                          <p className="text-sm font-bold text-gray-900">
                            {quote.address.suburb}, {quote.address.state} {quote.address.postcode}
                          </p>
                          <div className="mt-3.5 flex items-center gap-1.5 text-[10px] font-mono bg-[#141414]/5 px-2 py-1 rounded-xs w-fit">
                            <span>📍 GPS Destination</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Works planning line */}
                    <div className="bg-[#141414] text-[#E4E3E0] p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-none mb-8 border border-black gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4.5 h-4.5 shrink-0" />
                        <span className="text-[10.5px] font-mono tracking-wider font-bold">PLANNED WORKS DATE:</span>
                      </div>
                      <span className="text-sm font-bold bg-[#E4E3E0] text-[#141414] px-3.5 py-0.5 uppercase tracking-wide font-sans rounded-none">
                        {formattedDate(quote.plannedWorksDate)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Page header for subsequent pages */}
                    <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
                      <div className="flex items-center gap-3">
                        <img 
                          src="https://trade-trak-user-uploads.s3.ap-southeast-2.amazonaws.com/company/logo/0b0e820b8741632d2e12acd09f28b827.jpg" 
                          alt="Fencing Around Logo" 
                          className="w-10 h-10 border border-black object-contain p-0.5 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h2 className="text-sm font-bold uppercase tracking-tight font-sans text-gray-900">Fencing Around Picking Slip</h2>
                          <p className="text-[9px] font-mono text-gray-550">
                            System Ref ID: #{quote.id} | Planned works: {formattedDate(quote.plannedWorksDate)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="bg-[#141414] text-white text-[8px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 mb-1">
                          QT_{quote.quoteNumber}
                        </span>
                        <p className="text-[9px] text-gray-450 font-mono">
                          Page {pageIdx + 1} of {pagesData.length}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Grouped Supplier Tables */}
                <div className="space-y-6">
                  {pageSuppliers.map((supplier) => (
                    <div key={supplier} className="supplier-block break-inside-avoid">
                      {/* Supplier heading */}
                      <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-2.5">
                        <h2 className="text-xs font-extrabold uppercase tracking-wide font-sans text-black flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-black shrink-0" />
                          Supplier: {supplier}
                        </h2>
                        <span className="text-[9px] font-mono font-bold text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-xs border border-gray-150">
                          {pageGroupedBySupplier[supplier].length} Item{pageGroupedBySupplier[supplier].length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Supplier Table */}
                      <div className="overflow-x-auto border border-black/20 rounded-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-100 border-b border-black/20 font-mono text-[9px] font-bold uppercase tracking-wider text-gray-750">
                              {/* Digital Checkbox Column - Hidden in Print */}
                              <th className={`p-2 text-center w-10 ${isExportingPdf ? 'hidden' : 'print:hidden'} select-none`}>Pick</th>
                              <th className="p-2">Item Description</th>
                              <th className="p-2 text-center w-24">Qty Req.</th>
                              {/* Digital/Print Picked Column */}
                              <th className="p-2 text-center w-24">Qty Picked</th>
                              <th className="p-2 max-w-xs text-left">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageGroupedBySupplier[supplier].map((item) => {
                              const isChecked = pickedItems[item.id] || false;
                              const currentPickedCount = pickedCounts[item.id] ?? item.quantity;
                              
                              return (
                                <tr 
                                  key={item.id} 
                                  className={`border-b border-black/10 text-xs transition-all ${
                                    isChecked ? "bg-emerald-50/25 print:bg-transparent" : "hover:bg-gray-50/30"
                                  }`}
                                >
                                  {/* Checkbox (Digital-only control for live users) */}
                                  <td className={`p-2 text-center ${isExportingPdf ? 'hidden' : 'print:hidden'} cursor-pointer select-none`} onClick={() => toggleItemCheck(item.id)}>
                                    <button type="button" className="inline-flex items-center justify-center">
                                      {isChecked ? (
                                        <CheckSquare className="w-4 h-4 text-emerald-700" />
                                      ) : (
                                        <Square className="w-4 h-4 text-gray-400 hover:text-gray-900" />
                                      )}
                                    </button>
                                  </td>

                                  {/* Item Name */}
                                  <td className="p-2 font-medium text-gray-950">
                                    <span className={isChecked ? "line-through text-gray-400 print:no-underline print:text-gray-900" : ""}>
                                      {item.name}
                                    </span>
                                  </td>

                                  {/* Quantity Required */}
                                  <td className="p-2 text-center font-mono font-bold text-sm text-gray-900">
                                    {item.quantity} <span className="text-[9px] font-normal text-gray-500">{item.unit}</span>
                                  </td>

                                  {/* Picked Quantity Counter (Interactive on Web, Blank Line placeholders for printout) */}
                                  <td className="p-2 text-center">
                                    {/* Web Digital Input */}
                                    <div className={`${isExportingPdf ? 'hidden' : 'print:hidden'} flex items-center justify-center gap-1 max-w-[90px] mx-auto bg-gray-50 border border-black/10 px-1 py-0.5 rounded-sm`}>
                                      <input
                                        type="number"
                                        min="0"
                                        max={item.quantity}
                                        value={currentPickedCount}
                                        onChange={(e) => handleCountChange(item.id, item.quantity, e.target.value)}
                                        className="w-8 bg-transparent text-center text-xs font-mono font-bold focus:outline-hidden"
                                      />
                                      <span className="text-[9px] font-mono text-gray-400">/ {item.quantity}</span>
                                    </div>
                                    {/* Print Blank Placeholder Line */}
                                    <div className={`${isExportingPdf ? 'block' : 'hidden print:block'} font-mono text-gray-300`}>
                                      _________________
                                    </div>
                                  </td>

                                  {/* Line Item Notes */}
                                  <td className="p-2 text-gray-600 text-[10.5px] leading-snug">
                                    {item.notes || <span className="text-gray-300 font-mono">—</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sign Off box on the last page of the document */}
              {isLastPage ? (
                <div className="mt-8 pt-6 border-t border-black space-y-5 break-inside-avoid shadow-none">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-[#141414] text-white text-[8px] font-mono font-bold uppercase tracking-wider px-2 py-0.5">
                      SIGN OFF SECTION
                    </span>
                    <span className="text-[9px] text-gray-555 font-mono italic">To be executed by transport contractors on site</span>
                  </div>

                  {/* Drivers Layout */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs text-black">
                    <div className="space-y-3">
                      <div className="border-b border-black pb-1.5">
                        <p className="text-[9px] font-mono font-black text-gray-500 uppercase tracking-wider">LOADED & CHECKED BY</p>
                        <div className="h-7"></div>
                        <p className="text-gray-300 font-mono text-[9px]">Full Name: _________________</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="border-b border-black pb-1.5">
                        <p className="text-[9px] font-mono font-black text-gray-500 uppercase tracking-wider">DELIVERED BY</p>
                        <div className="h-7"></div>
                        <p className="text-gray-300 font-mono text-[9px]">Full Name: _________________</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="border-b border-black pb-1.5">
                        <p className="text-[9px] font-mono font-black text-gray-500 uppercase tracking-wider">DATE/TIME DELIVERED</p>
                        <div className="h-7"></div>
                        <p className="text-gray-300 font-mono text-[9px]">Date & Time: ____/____/2026</p>
                      </div>
                    </div>
                  </div>

                  {/* Customer Signature Box */}
                  <div className="bg-[#F9F9FA] border border-black p-3 rounded-none">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      <div className="md:col-span-8">
                        <h4 className="font-bold text-[10px] uppercase tracking-wider text-black">CUSTOMER DELIVERY ACCEPTANCE</h4>
                        <p className="text-[9px] text-gray-650 mt-1 leading-relaxed">
                          By signing below, the customer or site representative acknowledges that the quantities list above describes the actual heavy timber, fittings, or infill panels deposited on site in correct working quality.
                        </p>
                      </div>
                      <div className="md:col-span-4 grid grid-cols-2 gap-2 text-center">
                        <div className="border border-dashed border-gray-400 p-1.5 min-h-[42px] flex flex-col justify-between">
                          <span className="text-[7.5px] font-mono text-gray-400 block uppercase">INITIALS</span>
                          <div className="h-4"></div>
                          <span className="border-t border-gray-100 text-[7px] tracking-tight block text-gray-300 font-mono">PRINT ONLY</span>
                        </div>
                        <div className="border border-dashed border-gray-400 p-1.5 min-h-[42px] flex flex-col justify-between">
                          <span className="text-[7.5px] font-mono text-gray-400 block uppercase">SIGNATURE</span>
                          <div className="h-4"></div>
                          <span className="border-t border-gray-100 text-[7px] tracking-tight block text-gray-300 font-mono">PRINT ONLY</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer branding */}
                  <div className="flex justify-between items-center text-[8px] font-mono text-gray-400 pt-2 pb-0 border-t border-black/5">
                    <span>PRINT ID: FENCING-AROUND-QC-SLIP-REv4</span>
                    <span className="font-sans">Page {pageIdx + 1} of {pagesData.length} | Please verify string levels.</span>
                  </div>
                </div>
              ) : (
                /* Sub-page footer spacing and branding */
                <div className="flex justify-between items-center text-[8px] font-mono text-gray-400 pt-2 pb-0 border-t border-black/5">
                  <span>PRINT ID: FENCING-AROUND-QC-SLIP-REv4</span>
                  <span>Page {pageIdx + 1} of {pagesData.length}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Helper floating button bar below card (Web-only) */}
      {!isPrintPreviewMode && (
        <div className="print:hidden flex flex-col gap-3 p-3.5 shadow-xs shrink-0 select-none border bg-[#eae8e3]/70 border-black text-[#141414]">
          <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
            <span className="text-[10.5px] font-mono text-gray-650 flex items-center gap-1.5 font-bold uppercase transition-colors duration-300">
              <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
              A4 HIGH-COMPATIBILITY PDF OUTPUT
            </span>
            <div className="flex flex-wrap gap-2">
              {onTogglePreview && (
                <button
                  id="print-preview-toggle-preview"
                  type="button"
                  onClick={onTogglePreview}
                  disabled={isGeneratingPdf}
                  className="font-mono text-xs font-bold uppercase tracking-widest px-4 py-2 flex items-center gap-2 transition-all active:translate-y-[0.5px] cursor-pointer disabled:opacity-50 border bg-white hover:bg-gray-50 text-black border-black"
                >
                  <Eye className="w-4 h-4 text-sky-600" />
                  <span>Print Preview</span>
                </button>
              )}
              <button
                id="print-preview-standard-print"
                type="button"
                onClick={handlePrint}
                disabled={isGeneratingPdf}
                className="font-mono text-xs font-bold uppercase tracking-widest px-4 py-2 flex items-center gap-2 transition-all active:translate-y-[0.5px] cursor-pointer disabled:opacity-50 border bg-white hover:bg-gray-50 text-black border-black"
              >
                <Printer className="w-4 h-4" />
                Standard Print
              </button>
              <button
                id="print-preview-save-pdf"
                type="button"
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                className="font-mono text-xs font-bold uppercase tracking-widest px-4 py-2 flex items-center gap-2 transition-all active:translate-y-[0.5px] cursor-pointer disabled:opacity-50 border bg-[#141414] hover:bg-gray-800 text-white border-black"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    Save PDF Document
                  </>
                )}
              </button>
            </div>
          </div>

          {/* If inside an iframe and they try to use standard print, show the helpful popout instructions info box */}
          {showPrintHint && (
            <div className="bg-amber-50 border border-amber-500 p-3 text-xs leading-relaxed text-amber-950 font-sans mt-1">
              <p className="font-bold flex items-center gap-1.5 font-mono text-[10px] uppercase">
                ⚠️ Browser Sandbox Restricting Direct Iframe Printing
              </p>
              <p className="mt-1">
                Because this application is currently displaying inside a **sandboxed container iframe**, standard browsers block the physical printer pop-up.
              </p>
              <p className="mt-1.5 font-medium">
                To use physical paper print directly, please click the <strong className="font-semibold text-black">"Open App in New Tab"</strong> button (represented by an arrow-out icon ↗) in the **top right corner of your screen**, and click "Standard Print" there! Alternatively, simply use the <strong className="font-bold text-black">"Save PDF Document"</strong> button to download a perfect PDF immediately!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
