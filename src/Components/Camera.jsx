import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { DndContext, useDraggable } from "@dnd-kit/core";
import toast, { Toaster } from "react-hot-toast";

import Ronaldo from "/Ronaldo.png";
import Messi from "/Messi.png";
import Messi_scale from "/messi_scale.png";
import Ronaldo_scale from "/ronaldo_scale.png";
import Michael from "/michael.png";
import michael_scale from "/michael_scale.png";
import neymar_scale from "/neymar_scale.png";

import DownloadModal from "./Modal";

// --- NEW SUB-COMPONENT FOR DRAGGING ---
function DraggableCeleb({ celeb, scale, posX, posY }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: "celeb-overlay",
  });

  // Calculate the live position: Base State + Current Drag Offset
  const style = {
    position: "absolute",
    top: 0,
    left: 0,
    height: "90%",
    zIndex: 20,
    cursor: "grab",
    touchAction: "none", // Critical for mobile drag
    transform: transform
      ? `translate3d(${posX + transform.x}px, ${posY + transform.y}px, 0)`
      : `translate3d(${posX}px, ${posY}px, 0)`,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <img
        src={celeb.scale || celeb.url}
        style={{
          scale: scale,
          transformOrigin: "0 0",
          userSelect: "none",
        }}
        className="h-full w-auto object-contain drop-shadow-2xl pointer-events-none"
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [scale, setScale] = useState(1);
  const [posX, setPosX] = useState(100);
  const [posY, setPosY] = useState(50);

  const celebs = [
    { id: 1, name: "Ronaldo", url: Ronaldo, scale: Ronaldo_scale },
    { id: 2, name: "Messi", url: Messi, scale: Messi_scale },
    { id: 3, name: "Michael Jackson", url: Michael, scale: michael_scale },
    { id: 4, name: "Neymar", url: Messi, scale: neymar_scale },
  ];

  // --- DRAG END HANDLER ---
  const handleDragEnd = (event) => {
    const { delta } = event;
    // Calculate new position based on where the drag ended
    const newX = posX + delta.x;
    const newY = posY + delta.y;

    // Update State (for UI/Sliders)
    setPosX(newX);
    setPosY(newY);

    // Update Ref (for instant Canvas Capture)
    livePos.current = { x: newX, y: newY };
  };

  useEffect(() => {
    startCamera();
  }, []);

  useEffect(() => {
    if (capturedImage) setIsModalOpen(true);
  }, [capturedImage]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch (err) {
      console.error("Camera access denied", err);
      toast.error("Camera access denied. Please allow permissions.");
    }
  };

  const handleCaptureClick = () => {
    setShowCelebPanel(false);
    if (countdown !== null) return;
    setCapturedImage(null);

    let timer = 3;
    setCountdown(timer);

    const interval = setInterval(() => {
      timer -= 1;
      if (timer >= 1) {
        setCountdown(timer);
      } else {
        clearInterval(interval);
        setCountdown(null);
        takePhoto();
      }
    }, 1000);
  };

  const handleSliderPosition = (axis, value) => {
    const numValue = parseFloat(value);
    if (axis === "x") {
      setPosX(numValue);
      livePos.current.x = numValue;
    } else if (axis === "y") {
      setPosY(numValue);
      livePos.current.y = numValue;
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const celebImage = new Image();

    if (video && canvas) {
      const context = canvas.getContext("2d");
      const width = video.clientWidth;
      const height = video.clientHeight;
      canvas.width = width;
      canvas.height = height;

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      setIsFlash(true);
      setTimeout(() => setIsFlash(false), 150);

      context.drawImage(video, 0, 0, width, height);

      if (selectedCeleb) {
        celebImage.src = selectedCeleb.scale || selectedCeleb.url;

        celebImage.onload = () => {
          const baseHeight = height * 0.9;
          const drawHeight = baseHeight * scale;
          const drawWidth = (celebImage.width / celebImage.height) * drawHeight;

          // Use the ref for capture to ensure we have the absolute latest drag coordinates
          const x = livePos.current.x;
          const y = livePos.current.y;

          context.drawImage(celebImage, x, y, drawWidth, drawHeight);
          setCapturedImage(canvas.toDataURL("image/png"));
        };
      } else {
        setCapturedImage(canvas.toDataURL("image/png"));
      }
    }
  };

  const resetSelection = () => {
    setSelectedCeleb(null);
    setPosX(100);
    setPosY(50);
    livePos.current = { x: 100, y: 50 };
    setScale(1);
  };

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 overflow-hidden select-none text-white">
      <canvas ref={canvasRef} className="hidden" />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1e293b", // slate-800
            color: "#fff",
            borderRadius: "1rem",
          },
        }}
      />
      <div className="relative w-full max-w-4xl bg-slate-900 p-2 rounded-[2.5rem] shadow-2xl border border-white/5">
        <div
          ref={constraintsRef}
          className="relative aspect-video overflow-hidden rounded-[2rem] bg-stone-950"
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover transition-opacity duration-700 ${cameraReady ? "opacity-100" : "opacity-0"}`}
          />

          {/* DND CONTEXT WRAPPER */}
          <DndContext onDragEnd={handleDragEnd}>
            <AnimatePresence>
              {selectedCeleb && (
                <motion.div
                  key={selectedCeleb.id}
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

          {/* SLIDERS / PRECISION CONTROLS */}
          {selectedCeleb && !countdown && (
            <div className="absolute top-6 left-6 z-[40] flex flex-col gap-3">
              <div className="bg-black/30 backdrop-blur-xl p-5 rounded-[2rem] border border-white/10 space-y-4 shadow-2xl">
                <div className="space-y-1">
                  <label className="text-[10px] text-indigo-400 font-black uppercase tracking-widest block">
                    Scale
                  </label>
                  <input
                    type="range"
                    min="0.3"
                    max="2.5"
                    step="0.01"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-40 block accent-indigo-500 cursor-pointer"
                  />
                </div>

                <button
                  onClick={resetSelection}
                  className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-bold rounded-xl border border-red-500/20 uppercase transition-all"
                >
                  Remove Star
                </button>
              </div>
            </div>
          )}

          {isFlash && <div className="absolute inset-0 bg-white z-[100]" />}
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-[90] text-9xl font-black text-white">
              {countdown}
            </div>
          )}

          {/* BOTTOM NAVIGATION */}
          <div className="absolute inset-x-0 bottom-0 p-8 flex items-center justify-between z-30 pointer-events-none">
            <button
              onClick={() => capturedImage && setIsModalOpen(true)}
              className="w-16 h-16 rounded-2xl bg-slate-800/80 border-2 border-white/10 overflow-hidden pointer-events-auto active:scale-90 transition-all"
            >
              {capturedImage ? (
                <img
                  src={capturedImage}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-950/50" />
              )}
            </button>

            <button
              onClick={handleCaptureClick}
              className="w-20 h-20 rounded-full bg-white p-1 shadow-2xl pointer-events-auto active:scale-90 transition-transform"
            >
              <div className="w-full h-full rounded-full border-4 border-slate-900 bg-gradient-to-tr from-indigo-600 to-fuchsia-400 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full bg-white" />
              </div>
            </button>

            <button
              onClick={() => setShowCelebPanel(true)}
              className="p-5 rounded-2xl bg-indigo-600 text-white shadow-xl pointer-events-auto hover:bg-indigo-500 active:scale-95 transition-all"
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

          {/* SIDEBAR PANEL */}
          <div
            className={`absolute top-0 right-0 h-full w-72 bg-slate-950/95 backdrop-blur-2xl z-50 transition-transform duration-500 border-l border-white/10 flex flex-col ${showCelebPanel ? "translate-x-0" : "translate-x-full"}`}
          >
            <div className="p-8 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">
                Stars
              </h3>
              <button
                onClick={() => setShowCelebPanel(false)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {celebs.map((celeb) => (
                <button
                  key={celeb.id}
                  onClick={() => {
                    setSelectedCeleb(celeb);
                    setShowCelebPanel(false);
                    setPosX(100);
                    setPosY(50);
                    livePos.current = { x: 100, y: 50 };
                    setScale(1);
                  }}
                  className={`group relative w-full aspect-square rounded-[1.5rem] overflow-hidden border-2 transition-all ${selectedCeleb?.id === celeb.id ? "border-indigo-500 shadow-lg" : "border-white/5 hover:border-white/20"}`}
                >
                  <img
                    src={celeb.url}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-bold uppercase">
                      {celeb.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DownloadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageData={capturedImage}
      />
    </div>
  );
}
