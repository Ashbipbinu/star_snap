import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DndContext, useDraggable } from "@dnd-kit/core";
import toast, { Toaster } from "react-hot-toast";

// Assets
import Ronaldo from "/Ronaldo.png";
import Messi from "/Messi.png";
import Messi_scale from "/messi_scale.png";
import Ronaldo_scale from "/ronaldo_scale.png";
import Michael from "/michael.png";
import michael_scale from "/michael_scale.png";
import Neymar from "/Neymar.png";
import neymar_scale from "/neymar_scale.png";
import Maveli from "/Maveli.png";
import nivin_scale from "/nivin_scale.png";

import ResultPanel from "./ResultPanel";

function DraggableCeleb({ celeb, scale, posX, posY }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: "celeb-overlay",
  });

  const style = {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 20,
    cursor: "grab",
    touchAction: "none",
    transform: transform
      ? `translate3d(${posX + transform.x}px, ${posY + transform.y}px, 0)`
      : `translate3d(${posX}px, ${posY}px, 0)`,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <img
        src={celeb.scale || celeb.url}
        style={{
          height: "400px",
          width: "auto",
          scale: scale,
          transformOrigin: "0 0",
          userSelect: "none",
        }}
        className="object-contain drop-shadow-2xl pointer-events-none block"
      />
    </div>
  );
}

export default function Camera() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const constraintsRef = useRef(null);
  const livePos = useRef({ x: 100, y: 50 });

  const [cameraReady, setCameraReady] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [isFlash, setIsFlash] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [selectedCeleb, setSelectedCeleb] = useState(null);
  const [showCelebPanel, setShowCelebPanel] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const [scale, setScale] = useState(1);
  const [posX, setPosX] = useState(100);
  const [posY, setPosY] = useState(50);

  const celebs = [
    { id: 1, name: "Ronaldo", url: Ronaldo, scale: Ronaldo_scale },
    { id: 2, name: "Messi", url: Messi, scale: Messi_scale },
    { id: 3, name: "Michael Jackson", url: Michael, scale: michael_scale },
    { id: 4, name: "Neymar", url: Neymar, scale: neymar_scale },
    { id: 5, name: "Maveli", url: Maveli, scale: nivin_scale },
  ];

  const handleDragEnd = (event) => {
    const { delta } = event;
    const newX = posX + delta.x;
    const newY = posY + delta.y;
    setPosX(newX);
    setPosY(newY);
    livePos.current = { x: newX, y: newY };
  };

  useEffect(() => {
    startCamera();
  }, []);

  const startCamera = async () => {
    try {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch (err) {
      toast.error("Camera access denied.");
    }
  };

  const takePhoto = () => {
  const video = videoRef.current;
  const canvas = canvasRef.current;
  if (video && canvas) {
    const context = canvas.getContext("2d");
    
    // 1. Get Video's actual internal resolution
    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;

    // 2. Set Canvas Size based on Orientation (3:2 Ratio for 6x4 paper)
    // We use a high base (e.g., 1800px) to ensure sharp 300dpi prints
    if (isLandscape) {
      canvas.width = 1800; 
      canvas.height = 1200;
    } else {
      canvas.width = 1200;
      canvas.height = 1800;
    }

    setIsFlash(true);
    setTimeout(() => setIsFlash(false), 150);

    // 3. Logic to "Cover" the canvas with the video feed (No stretching)
    const canvasRatio = canvas.width / canvas.height;
    const videoRatio = vWidth / vHeight;
    let sX = 0, sY = 0, sW = vWidth, sH = vHeight;

    if (videoRatio > canvasRatio) {
      sW = vHeight * canvasRatio;
      sX = (vWidth - sW) / 2;
    } else {
      sH = vWidth / canvasRatio;
      sY = (vHeight - sH) / 2;
    }

    context.save();
    
    // MIRROR FIX: 
    // The video is mirrored in UI for the user, but for the print, 
    // we capture it "natural" (non-mirrored) so text is readable.
    context.drawImage(video, sX, sY, sW, sH, 0, 0, canvas.width, canvas.height);
    
    context.restore();

    const finalizeCapture = (imgSrc) => {
      setCapturedImage(imgSrc);
      setIsFlipped(true);
    };

    // 4. Draw Celebrity Overlay
    if (selectedCeleb) {
      const celebImg = new Image();
      celebImg.src = selectedCeleb.scale || selectedCeleb.url;
      celebImg.onload = () => {
        // We scale the celeb relative to the canvas height
        const drawHeight = (400 * scale) * (canvas.height / video.clientHeight);
        const drawWidth = (celebImg.width / celebImg.height) * drawHeight;
        
        // Map UI position to Canvas position
        const drawX = (livePos.current.x / video.clientWidth) * canvas.width;
        const drawY = (livePos.current.y / video.clientHeight) * canvas.height;

        context.drawImage(celebImg, drawX, drawY, drawWidth, drawHeight);
        finalizeCapture(canvas.toDataURL("image/png"));
      };
    } else {
      finalizeCapture(canvas.toDataURL("image/png"));
    }
  }
};

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-screen bg-slate-950 p-4 overflow-hidden select-none text-white font-sans">
      <canvas ref={canvasRef} className="hidden" />
      <Toaster position="top-right" />

      {/* 3D Perspective Wrapper */}
      <div style={{ perspective: "2000px" }} className="relative w-fit mx-auto">
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{
            duration: 0.8,
            type: "spring",
            stiffness: 100,
            damping: 20,
          }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative bg-slate-900 p-2 rounded-[2.5rem] shadow-2xl border border-white/5"
        >
          {/* FRONT: CAMERA UI */}
          <div
            style={{ backfaceVisibility: "hidden" }}
            className="relative z-10"
          >
            <div
              ref={constraintsRef}
              className="relative overflow-hidden rounded-[2rem] bg-stone-950"
              style={{
                height: "85vh",
                width: "calc(85vh * 16 / 9)",
                maxHeight: "100%",
                maxWidth: "90vw",
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              <DndContext onDragEnd={handleDragEnd}>
                <AnimatePresence>
                  {selectedCeleb && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <DraggableCeleb
                        celeb={selectedCeleb}
                        scale={scale}
                        posX={posX}
                        posY={posY}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </DndContext>

              {/* Controls overlay */}
              <div className="absolute top-4 left-4 right-4 z-[40] flex justify-between items-start pointer-events-none">
                {selectedCeleb && !countdown ? (
                  <div className="bg-black/40 backdrop-blur-xl p-4 rounded-3xl border border-white/10 space-y-3 pointer-events-auto">
                    <input
                      type="range"
                      min="0.3"
                      max="2.5"
                      step="0.01"
                      value={scale}
                      onChange={(e) => setScale(parseFloat(e.target.value))}
                      className="w-32 block accent-indigo-500"
                    />
                    <button
                      onClick={() => setSelectedCeleb(null)}
                      className="w-full text-[10px] font-bold text-red-400 uppercase"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div />
                )}

                <button
                  onClick={() => {
                    const newMode = !isLandscape;
                    setIsLandscape(newMode);
                    toast.success(
                      newMode ? "↔️ Landscape print mode" : "↕️ Portrait print mode",
                      { duration: 2000 }
                    );
                  }}
                  className="p-4 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 text-white pointer-events-auto active:scale-95 transition-all shadow-xl"
                >
                  <svg
                    className={`w-6 h-6 transition-transform duration-500 ${isLandscape ? "rotate-90" : "rotate-0"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                </button>
              </div>

              {isFlash && <div className="absolute inset-0 bg-white z-[100]" />}
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-[90] text-8xl font-black">
                  {countdown}
                </div>
              )}

              {/* Footer UI */}
              <div className="absolute inset-x-0 bottom-0 p-6 flex items-center justify-between z-30 pointer-events-none">
                <div
                  onClick={() => capturedImage && setIsFlipped(true)}
                  className="w-14 h-14 rounded-xl bg-slate-800 border border-white/10 overflow-hidden pointer-events-auto cursor-pointer"
                >
                  {capturedImage && (
                    <img
                      src={capturedImage}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <button
                  onClick={() => {
                    setShowCelebPanel(false);
                    if (countdown !== null) return;
                    setCountdown(3);
                    let timer = 3;
                    const interval = setInterval(() => {
                      timer -= 1;
                      setCountdown(timer >= 1 ? timer : null);
                      if (timer <= 0) {
                        clearInterval(interval);
                        takePhoto();
                      }
                    }, 1000);
                  }}
                  className="w-16 h-16 rounded-full bg-white p-1 pointer-events-auto active:scale-90 transition-transform shadow-2xl"
                >
                  <div className="w-full h-full rounded-full border-2 border-slate-900 bg-gradient-to-tr from-indigo-600 to-fuchsia-400" />
                </button>

                <button
                  onClick={() => setShowCelebPanel(true)}
                  className="p-4 rounded-xl bg-indigo-600 text-white pointer-events-auto active:scale-95 shadow-xl"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </button>
              </div>

              {/* Sidebar */}
              <div
                className={`absolute top-0 right-0 h-full w-64 bg-slate-950/95 backdrop-blur-2xl z-50 transition-transform duration-500 border-l border-white/10 flex flex-col ${showCelebPanel ? "translate-x-0" : "translate-x-full"}`}
              >
                <div className="p-6 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                    Stars
                  </span>
                  <button onClick={() => setShowCelebPanel(false)}>✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {celebs.map((celeb) => (
                    <button
                      key={celeb.id}
                      onClick={() => {
                        setSelectedCeleb(celeb);
                        setShowCelebPanel(false);
                        setPosX(50);
                        setPosY(50);
                        livePos.current = { x: 50, y: 50 };
                      }}
                      className="w-full aspect-square rounded-2xl overflow-hidden border-2 border-white/5 hover:border-indigo-500 transition-all bg-slate-900"
                    >
                      <img
                        src={celeb.url}
                        className="w-full h-full object-cover hover:scale-110 transition-transform"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* BACK: RESULT UI */}
          <div
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              position: "absolute",
              inset: "8px",
            }}
            className="z-0"
          >
            <ResultPanel
              imageData={capturedImage}
              onReset={() => setIsFlipped(false)}
              isLandscape={isLandscape}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
