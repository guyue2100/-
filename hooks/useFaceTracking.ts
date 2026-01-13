
import { useEffect, useRef, useState } from 'react';
import { LookTarget } from '../types';

export function useFaceTracking() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [lookAt, setLookAt] = useState<LookTarget>({ x: 0, y: 0 });
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const idleRef = useRef({ phase: 0, speed: 0.015, lastDetected: 0 });
  
  // Smoothing refs
  const smoothedPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let animationFrame: number;
    
    const startTracking = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 320 }, 
            height: { ideal: 240 },
            facingMode: "user" 
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const processFrame = () => {
          if (videoRef.current && videoRef.current.readyState === 4) {
            canvas.width = 80; // Low res for performance
            canvas.height = 60;
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            let totalX = 0;
            let totalY = 0;
            let points = 0;

            // Skin tone / Face region detection heuristic
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              
              // Standard skin tone heuristic
              const isSkin = r > 80 && g > 40 && b > 30 && r > g && (r - g) > 10;
              
              if (isSkin) {
                const x = (i / 4) % canvas.width;
                const y = Math.floor((i / 4) / canvas.width);
                totalX += x;
                totalY += y;
                points++;
              }
            }

            if (points > 40) { // Threshold for "face" detection
              const centerX = totalX / points;
              const centerY = totalY / points;
              
              // Target normalized coordinates (-1 to 1)
              const tx = -((centerX / canvas.width) * 2 - 1);
              const ty = (centerY / canvas.height) * 2 - 1;

              // Smoothing
              smoothedPos.current.x = smoothedPos.current.x * 0.85 + tx * 0.15;
              smoothedPos.current.y = smoothedPos.current.y * 0.85 + ty * 0.15;

              // Saccadic movement
              const jitterX = (Math.random() - 0.5) * 0.02;
              const jitterY = (Math.random() - 0.5) * 0.02;

              setLookAt({
                x: smoothedPos.current.x + jitterX,
                y: smoothedPos.current.y + jitterY
              });
              
              if (!isFaceDetected) setIsFaceDetected(true);
              idleRef.current.lastDetected = Date.now();
            } else {
              // Idle behavior
              if (Date.now() - idleRef.current.lastDetected > 1000) {
                if (isFaceDetected) setIsFaceDetected(false);
                
                idleRef.current.phase += idleRef.current.speed;
                const ix = Math.sin(idleRef.current.phase) * 0.3;
                const iy = Math.cos(idleRef.current.phase * 0.6) * 0.15;
                
                smoothedPos.current.x = smoothedPos.current.x * 0.98 + ix * 0.02;
                smoothedPos.current.y = smoothedPos.current.y * 0.98 + iy * 0.02;

                setLookAt({
                  x: smoothedPos.current.x,
                  y: smoothedPos.current.y
                });
              }
            }
          }
          animationFrame = requestAnimationFrame(processFrame);
        };

        processFrame();
      } catch (err) {
        console.error("Tracking error:", err);
      }
    };

    startTracking();

    return () => {
      cancelAnimationFrame(animationFrame);
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isFaceDetected]);

  return { videoRef, lookAt, isFaceDetected };
}
