import { useEffect, useRef, useState, Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { 
  useGLTF, 
  OrbitControls, 
  ContactShadows, 
  Environment, 
  PivotControls 
} from "@react-three/drei";
import * as THREE from "three";
import toast, { Toaster } from "react-hot-toast";

function Chair({ scale, clipZ }) {
  const { scene } = useGLTF("chair.glb");
  
  // Create a clipping plane based on the clipZ value
  // This plane "cuts" the object so things in front of it are invisible
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), clipZ), [clipZ]);

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Apply the clipping plane to the material
        child.material.clippingPlanes = [clipPlane];
        child.material.clipShadows = true;
        child.material.needsUpdate = true;
      }
    });
  }, [scene, clipPlane]);

  return <primitive object={scene} scale={scale} />;
}

export default function Camera3D() {
  const videoRef = useRef(null);
  const [showModel, setShowModel] = useState(false);
  const [scale, setScale] = useState(1.5);
  const [clipZ, setClipZ] = useState(0.5); // Depth of the "cut"
  const [isCameraReady, setIsCameraReady] = useState(false);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setIsCameraReady(true);
        }
      } catch (err) {
        toast.error("Camera access denied.");
      }
    }
    startCamera();
    return () => videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
  }, []);

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-screen bg-slate-950 p-4 text-white font-sans">
      <Toaster />
      
      <div className="relative w-full max-w-5xl aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black">
        
        {/* VIDEO LAYER */}
        <video 
          ref={videoRef} 
          autoPlay playsInline muted 
          className="absolute inset-0 w-full h-full object-cover z-0" 
          style={{ transform: "scaleX(-1)" }} 
        />

        {/* 3D LAYER */}
        <div className="absolute inset-0 z-10 pointer-events-auto">
          {isCameraReady && (
            <Canvas 
              shadows 
              camera={{ position: [0, 0, 5], fov: 45 }}
              gl={{ localClippingEnabled: true }} // REQUIRED for clipping to work
            >
              <ambientLight intensity={0.5} />
              <spotLight position={[5, 5, 5]} intensity={1} castShadow />
              <Environment preset="city" />

              <Suspense fallback={null}>
                {showModel && (
                  <PivotControls 
                    activeAxes={[true, true, true]} 
                    depthTest={false} 
                    anchor={[0, 0, 0]}
                    scale={0.75}
                  >
                    <group position={[0, -1, 0]}>
                      <Chair scale={scale} clipZ={clipZ} />
                      <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={10} blur={2} />
                    </group>
                  </PivotControls>
                )}
              </Suspense>
              
              <OrbitControls makeDefault enablePan={false} />
            </Canvas>
          )}
        </div>

        {/* CONTROLS UI */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-4">
           <button 
             onClick={() => setShowModel(!showModel)}
             className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-xl border ${
               showModel ? "bg-white text-black" : "bg-indigo-600 text-white border-indigo-400"
             }`}
           >
             {showModel ? "✕" : "🪑"}
           </button>
           
           {showModel && (
             <div className="flex flex-col items-center bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 gap-6">
               <div className="flex flex-col items-center gap-2">
                 <span className="text-[9px] font-bold uppercase tracking-tighter text-gray-400">Scale</span>
                 <input 
                   type="range" min="0.5" max="3" step="0.1" value={scale}
                   onChange={(e) => setScale(parseFloat(e.target.value))} 
                   className="h-24 accent-indigo-500 appearance-none bg-white/20 rounded-full w-1"
                   style={{ WebkitAppearance: 'slider-vertical' }}
                 />
               </div>

               <div className="flex flex-col items-center gap-2">
                 <span className="text-[9px] font-bold uppercase tracking-tighter text-gray-400">Depth</span>
                 <input 
                   type="range" min="-1" max="1" step="0.1" value={clipZ}
                   onChange={(e) => setClipZ(parseFloat(e.target.value))} 
                   className="h-24 accent-emerald-500 appearance-none bg-white/20 rounded-full w-1"
                   style={{ WebkitAppearance: 'slider-vertical' }}
                 />
               </div>
             </div>
           )}
        </div>
      </div>

      <div className="mt-4 flex gap-6 text-white/20 text-[10px] uppercase tracking-widest font-medium">
        <span>1. Drag Chair into position</span>
        <span>2. Adjust 'Depth' until you are "inside"</span>
      </div>
    </div>
  );
}