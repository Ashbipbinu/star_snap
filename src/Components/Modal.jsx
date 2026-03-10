import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function DownloadModal({ isOpen, onClose, imageData }) {
  const [cloudinaryUrl, setCloudinaryUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Cloudinary Configuration
  const CLOUD_NAME = "ashbi-cloud";
  const UPLOAD_PRESET = "snap_star";

  useEffect(() => {
    if (isOpen && imageData) {
      uploadToCloudinary(imageData);
    } else {
      setCloudinaryUrl("");
    }
  }, [isOpen, imageData]);

  const uploadToCloudinary = async (base64Data) => {
    // 1. Initiate loading state
    setIsUploading(true);

    const uploadTask = (async () => {
      const formData = new FormData();
      formData.append("file", base64Data);
      formData.append("upload_preset", UPLOAD_PRESET);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Upload failed");

      const downloadUrl = data.secure_url.replace(
        "/upload/",
        "/upload/fl_attachment/"
      );
      setCloudinaryUrl(downloadUrl);
      return data;
    })();

    // 2. Wrap the task in toast.promise and ensure spinner stops on finally
    toast.promise(uploadTask, {
      loading: 'Uploading to cloud...',
      success: 'Successfully uploaded!',
      error: (err) => `Error: ${err.message}`,
    }).finally(() => {
      setIsUploading(false);
    });
  };

  if (!imageData) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-5xl bg-slate-900 border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row"
          >
            {/* Left Side: Image Preview */}
            <div className="flex-[1.5] bg-black flex items-center justify-center p-4">
              <img
                src={imageData}
                alt="Captured"
                className="max-h-[70vh] w-auto object-contain rounded-[1.5rem] shadow-2xl"
              />
            </div>

            {/* Right Side: Action Panel */}
            <div className="flex-1 p-8 flex flex-col items-center justify-center bg-slate-900/50 border-l border-white/5">
              <h2 className="text-white text-xl font-black uppercase tracking-widest mb-6">
                Photo Ready!
              </h2>

              <div className="bg-white p-4 rounded-[2rem] shadow-2xl mb-4 relative overflow-hidden">
                {isUploading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-[8px] text-indigo-600 font-bold uppercase">
                      Uploading...
                    </p>
                  </div>
                )}

                <QRCodeSVG
                  value={cloudinaryUrl || "Generating..."}
                  size={150}
                  level="L"
                  includeMargin={true}
                />
              </div>

              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest text-center mb-8">
                {cloudinaryUrl
                  ? "Scan to Download to Phone"
                  : "Preparing your QR code..."}
              </p>

              <div className="w-full space-y-3">
                <button
                  onClick={onClose}
                  className="w-full py-4 bg-white/5 text-slate-400 border border-white/10 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                >
                  Back to Camera
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}