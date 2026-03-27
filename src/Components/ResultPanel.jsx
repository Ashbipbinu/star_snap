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
    // Load existing printer selection
    if (window.electron?.getSelectedPrinter) {
      window.electron.getSelectedPrinter().then((printer) => {
        if (printer) {
          setSelectedPrinter(printer);
          console.log("Loaded printer:", printer);
        }
      });
    }

    // Listen for printer selection updates from menu
    let unsubscribePrinter;
    if (window.electron?.onPrinterSelected) {
      unsubscribePrinter = window.electron.onPrinterSelected((printer) => {
        console.log("Received printer:", printer);
        setSelectedPrinter(printer);
        toast.success(`Printer connected: ${printer}`);
      });
    }

    // Listen for print result from main process
    let unsubscribePrintResult;
    if (window.electron?.onPrintResult) {
      unsubscribePrintResult = window.electron.onPrintResult(
        ({ success, reason }) => {
          setIsPrinting(false);
          toast.dismiss("print-toast");
          if (success) {
            toast.success("Photo printed successfully!");
          } else {
            toast.error(`Print failed: ${reason || "Unknown error"}`);
          }
        },
      );
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
        { method: "POST", body: formData },
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Upload failed");

      const downloadUrl = data.secure_url.replace(
        "/upload/",
        "/upload/fl_attachment/",
      );
      setCloudinaryUrl(downloadUrl);
      return data;
    })();

    toast
      .promise(uploadTask, {
        loading: "Saving to cloud...",
        success: "Image Saved!",
        error: (err) => `Error: ${err.message}`,
      })
      .finally(() => setIsUploading(false));
  };

  // ✅ Helper to send print with fallback timeout
  const sendPrint = (image, landscape) => {
    window.electron?.printImage({
      image,
      printerName: selectedPrinter,
      landscape,
    });
    toast.loading("Sending to printer...", { id: "print-toast" });

    // Fallback — if no response in 10 seconds, assume success (virtual printer edge case)
    setTimeout(() => {
      setIsPrinting((current) => {
        if (current) {
          toast.dismiss("print-toast");
          toast.success("Print job sent!");
          return false;
        }
        return current;
      });
    }, 10000);
  };

  const handlePrint = () => {
    if (!imageData) {
      toast.error("No photo found to print!");
      return;
    }
    if (!selectedPrinter) {
      toast.error("Please select a printer from Settings → Connect Printer");
      return;
    }
    if (isPrinting) {
      toast("Already printing, please wait...");
      return;
    }

    try {
      setIsPrinting(true);

      if (isLandscape) {
        // ✅ Rotate image 90° clockwise for landscape printing
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          // Swap width and height for landscape orientation
          canvas.width = img.height;
          canvas.height = img.width;
          const ctx = canvas.getContext("2d");
          // Rotate 90 degrees clockwise
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          const rotatedImage = canvas.toDataURL("image/png");
          sendPrint(rotatedImage, true);
        };
        img.src = imageData;
      } else {
        // ✅ Portrait — send as-is
        sendPrint(imageData, false);
      }
    } catch (error) {
      setIsPrinting(false);
      toast.dismiss("print-toast");
      console.error("Printer Error:", error);
      toast.error("Printer not available or connection failed.");
    }
  };

  return (
    <div
      className={`w-full h-full bg-slate-900 rounded-[2rem] flex p-6 gap-6 overflow-hidden ${
        isLandscape ? "flex-row items-stretch" : "flex-col items-center"
      }`}
    >
      {/* Photo Preview Section */}
      <div
        className={`flex items-center justify-center bg-black/40 rounded-3xl border border-white/5 overflow-hidden transition-all duration-500 ${
          isLandscape ? "flex-[1.8]" : "w-full flex-[2.2]"
        }`}
      >
        <img
          src={imageData}
          className="max-h-full max-w-full object-contain shadow-2xl"
          alt="Result"
        />
      </div>

      {/* QR & Action Section */}
      <div
        className={`flex flex-col items-center justify-center bg-black/20 rounded-3xl border border-white/5 p-4 transition-all duration-500 ${
          isLandscape ? "flex-1 min-w-[280px]" : "w-full flex-1"
        }`}
      >
        <div
          className={`bg-white p-2 rounded-[2rem] relative shadow-2xl transition-all border-4 border-white/10 ${
            isLandscape ? "mb-8" : "mb-2"
          }`}
        >
          {isUploading && (
            <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10 rounded-[1.8rem]">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <QRCodeSVG
            value={cloudinaryUrl || "Uploading..."}
            size={isLandscape ? 220 : 130}
            level="H"
            includeMargin={true}
          />
        </div>

        {/* Printer status indicator */}
        <p className="text-[10px] text-center mb-2 px-2">
          {selectedPrinter ? (
            <span className="text-green-400 font-bold">
              🖨 {selectedPrinter}
            </span>
          ) : (
            <span className="text-yellow-400">No printer selected</span>
          )}
        </p>

        {/* Print mode indicator */}
        <p className="text-[10px] text-center mb-2 px-2">
          <span className="text-indigo-400 font-bold">
            {isLandscape ? "↔️ Landscape" : "↕️ Portrait"} print mode
          </span>
        </p>

        <div className="w-full text-center max-w-[240px] flex flex-col gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-2 px-2 leading-tight">
            {cloudinaryUrl ? "Scan to Download" : "Uploading..."}
          </p>
          <button
            onClick={onReset}
            disabled={isUploading}
            className="w-full py-3 px-6 disabled:opacity-50 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-[11px] active:scale-95 transition-all shadow-xl hover:bg-indigo-50 hover:text-slate-900 border border-white/20"
          >
            Retake Photo
          </button>
          <button
            onClick={handlePrint}
            disabled={isPrinting || !selectedPrinter}
            className="w-full py-3 px-6 disabled:opacity-40 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-[11px] active:scale-95 transition-all shadow-xl hover:bg-indigo-50 hover:text-slate-900 border border-white/20"
          >
            {isPrinting ? "Printing..." : "Print Photo"}
          </button>
        </div>
      </div>
    </div>
  );
}