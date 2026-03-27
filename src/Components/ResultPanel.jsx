import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";

export default function ResultPanel({ imageData, onReset, isLandscape }) {
  const [cloudinaryUrl, setCloudinaryUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);

  const CLOUD_NAME = "ashbi-cloud";
  const UPLOAD_PRESET = "snap_star";

  useEffect(() => {
    if (imageData) {
      uploadToCloudinary(imageData);
    } else {
      setCloudinaryUrl("");
    }
  }, [imageData]);

  useEffect(() => {
    if (window.electron?.getSelectedPrinter) {
      window.electron.getSelectedPrinter().then((printer) => {
        if (printer) setSelectedPrinter(printer);
      });
    }

    let unsubscribePrinter;
    if (window.electron?.onPrinterSelected) {
      unsubscribePrinter = window.electron.onPrinterSelected((printer) => {
        setSelectedPrinter(printer);
        toast.success(`Printer connected: ${printer}`);
      });
    }

    let unsubscribePrintResult;
    if (window.electron?.onPrintResult) {
      unsubscribePrintResult = window.electron.onPrintResult(({ success, reason }) => {
        setIsPrinting(false);
        toast.dismiss("print-toast");
        if (success) toast.success("Photo printed successfully!");
        else toast.error(`Print failed: ${reason || "Unknown error"}`);
      });
    }

    return () => {
      unsubscribePrinter?.();
      unsubscribePrintResult?.();
    };
  }, []);

  const uploadToCloudinary = async (base64Data) => {
    setIsUploading(true);
    const uploadTask = (async () => {
      const formData = new FormData();
      formData.append("file", base64Data);
      formData.append("upload_preset", UPLOAD_PRESET);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Upload failed");

      const downloadUrl = data.secure_url.replace("/upload/", "/upload/fl_attachment/");
      setCloudinaryUrl(downloadUrl);
      return data;
    })();

    toast.promise(uploadTask, {
      loading: "Saving to cloud...",
      success: "Image Saved!",
      error: (err) => `Error: ${err.message}`,
    }).finally(() => setIsUploading(false));
  };

  const handlePrint = () => {
    if (!imageData) return toast.error("No photo found!");
    if (!selectedPrinter) return toast.error("Select a printer in Settings");
    if (isPrinting) return;

    setIsPrinting(true);
    toast.loading("Sending to printer...", { id: "print-toast" });

    window.electron?.printImage({
      image: imageData,
      printerName: selectedPrinter,
      landscape: isLandscape, // This still controls the paper orientation, not the UI
    });

    setTimeout(() => {
      if (isPrinting) {
        setIsPrinting(false);
        toast.dismiss("print-toast");
      }
    }, 10000);
  };

  return (
    /* Main container is now FIXED to flex-row (Landscape UI) */
    <div className="w-full h-full bg-slate-900 rounded-[2rem] flex flex-row items-stretch p-6 gap-6 overflow-hidden">
      
      {/* Photo Preview Section - Fixed to the left side */}
      <div className="flex-[1.8] flex items-center justify-center bg-black/40 rounded-3xl border border-white/5 overflow-hidden">
        <img
          src={imageData}
          className="max-h-full max-w-full object-contain shadow-2xl"
          alt="Result"
        />
      </div>

      {/* QR & Action Section - Fixed to the right side */}
      <div className="flex-1 min-w-[280px] flex flex-col items-center justify-center bg-black/20 rounded-3xl border border-white/5 p-4">
        
        {/* QR Code Container */}
        <div className="bg-white p-2 rounded-[2rem] relative shadow-2xl mb-8 border-4 border-white/10">
          {isUploading && (
            <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10 rounded-[1.8rem]">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <QRCodeSVG
            value={cloudinaryUrl || "Uploading..."}
            size={220}
            level="H"
            includeMargin={true}
          />
        </div>

        {/* Status Text */}
        <div className="text-center mb-4">
          <p className="text-[10px] text-green-400 font-bold mb-1">
            {selectedPrinter ? `🖨 ${selectedPrinter}` : "No printer selected"}
          </p>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 leading-tight">
            {cloudinaryUrl ? "Scan to Download" : "Uploading..."}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-[240px] flex flex-col gap-2">
          <button
            onClick={onReset}
            disabled={isUploading}
            className="w-full py-3 px-6 disabled:opacity-50 bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-[11px] active:scale-95 transition-all hover:bg-slate-700 border border-white/10"
          >
            Retake Photo
          </button>
          <button
            onClick={handlePrint}
            disabled={isPrinting || !selectedPrinter}
            className="w-full py-3 px-6 disabled:opacity-40 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[11px] active:scale-95 transition-all shadow-xl hover:bg-indigo-500 border border-white/10"
          >
            {isPrinting ? "Printing..." : "Print Photo"}
          </button>
        </div>
      </div>
    </div>
  );
}