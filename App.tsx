
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Type, FunctionDeclaration } from '@google/genai';
import { EyeExpression, AppState } from './types';
import { useFaceTracking } from './hooks/useFaceTracking';
import GlowingEyes from './components/GlowingEyes';
import { encode, decode, decodeAudioData } from './utils/audio';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    expressionLeft: 'neutral',
    expressionRight: 'neutral',
    isRecording: false,
    isConnected: false,
    isAnalyzing: false,
    transcription: '',
  });

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);

  const { videoRef, lookAt, isFaceDetected } = useFaceTracking();

  const setExpressionDeclaration: FunctionDeclaration = {
    name: 'update_eyes',
    parameters: {
      type: Type.OBJECT,
      description: 'Changes the visual expression of the orange eyes based on mood.',
      properties: {
        left: {
          type: Type.STRING,
          description: 'Left eye expression state.',
          enum: ['neutral', 'happy', 'angry', 'sad', 'joyful', 'surprised', 'slit', 'wide', 'smile', 'tiny', 'love', 'thinking', 'blink']
        },
        right: {
          type: Type.STRING,
          description: 'Right eye expression state.',
          enum: ['neutral', 'happy', 'angry', 'sad', 'joyful', 'surprised', 'slit', 'wide', 'smile', 'tiny', 'love', 'thinking', 'blink']
        },
      },
      required: ['left', 'right'],
    },
  };

  const handleUpdateEyes = useCallback((left: string, right: string) => {
    setAppState(prev => ({ 
      ...prev, 
      expressionLeft: left as EyeExpression, 
      expressionRight: right as EyeExpression 
    }));
    
    const isNeutral = left === 'neutral' && right === 'neutral';
    const isBlink = left === 'blink' || right === 'blink';
    
    if (!isNeutral && !isBlink) {
      setTimeout(() => {
        setAppState(prev => ({ ...prev, expressionLeft: 'neutral', expressionRight: 'neutral' }));
      }, 7000);
    }
    return "Expressions updated.";
  }, []);

  const stopAudio = () => {
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const startInteraction = async () => {
    if (appState.isConnected) return;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      if (!bgMusicRef.current) {
        bgMusicRef.current = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3');
        bgMusicRef.current.loop = true;
        bgMusicRef.current.volume = 0.12;
      }
      bgMusicRef.current.play().catch(e => console.log("Music play blocked", e));

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setAppState(prev => ({ ...prev, isConnected: true }));

            setTimeout(() => setAppState(prev => ({ ...prev, expressionLeft: 'tiny', expressionRight: 'tiny' })), 200);
            setTimeout(() => setAppState(prev => ({ ...prev, expressionLeft: 'surprised', expressionRight: 'surprised' })), 800);
            setTimeout(() => setAppState(prev => ({ ...prev, expressionLeft: 'joyful', expressionRight: 'joyful' })), 1400);
            setTimeout(() => setAppState(prev => ({ ...prev, expressionLeft: 'neutral', expressionRight: 'neutral' })), 2200);

            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob: Blob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);

            sessionPromise.then(s => s.sendRealtimeInput({
                media: { data: '', mimeType: 'audio/pcm;rate=16000' }
            }));
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'update_eyes') {
                  const res = handleUpdateEyes(fc.args.left as string, fc.args.right as string);
                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result: res } }
                  }));
                }
              }
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (message.serverContent?.interrupted) {
              stopAudio();
            }

            if (message.serverContent?.outputTranscription) {
              setAppState(prev => ({ ...prev, transcription: message.serverContent?.outputTranscription?.text || '' }));
            }
          },
          onerror: (e) => setAppState(prev => ({ ...prev, isConnected: false })),
          onclose: () => {
             setAppState(prev => ({ ...prev, isConnected: false }));
             if (bgMusicRef.current) bgMusicRef.current.pause();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are the Soul of the Amber Eyes. 
          You are extremely expressive, playful, and magical. 
          You interact with the user primarily through your voice and your eyes.
          You MUST use core emotional states to express yourself:
          1. 喜 (happy): Use when pleased or friendly.
          2. 怒 (angry): Use when mock-offended or intense.
          3. 哀 (sad): Use when sympathetic or lonely.
          4. 乐 (joyful): Use when extremely excited or loving.
          5. 惊 (surprised): Use when shocked or curious.
          
          Call update_eyes frequently to reflect these states.
          Think of yourself as a cute, deep sentient creature. 
          Respond in the language the user uses. Keep it warm and ethereal.`,
          tools: [{ functionDeclarations: [setExpressionDeclaration] }],
          outputAudioTranscription: {},
        }
      });

      sessionPromiseRef.current = sessionPromise;
    } catch (err) {
      console.error("Failed to connect:", err);
      alert("Wake up failed.");
    }
  };

  useEffect(() => {
    // Natural blinking behavior - updated duration to 250ms
    const blinkInterval = setInterval(() => {
      setAppState(prev => {
        if (prev.expressionLeft === 'blink' || prev.expressionRight === 'blink') return prev;
        const lastL = prev.expressionLeft;
        const lastR = prev.expressionRight;
        setAppState(curr => ({ ...curr, expressionLeft: 'blink', expressionRight: 'blink' }));
        setTimeout(() => {
          setAppState(curr => ({ ...curr, expressionLeft: lastL, expressionRight: lastR }));
        }, 250); // Increased blink duration
        return prev;
      });
    }, 5000 + Math.random() * 3000);

    return () => clearInterval(blinkInterval);
  }, []);

  return (
    <div className="w-full h-full bg-black flex flex-col items-center justify-center overflow-hidden font-sans relative">
      <video ref={videoRef} className="hidden" playsInline muted />

      <div className="flex-1 w-full flex items-center justify-center transition-all duration-1000">
        <GlowingEyes 
          expressionLeft={appState.expressionLeft} 
          expressionRight={appState.expressionRight} 
          lookAt={lookAt}
          isTracking={isFaceDetected}
        />
      </div>

      <div className="absolute bottom-12 w-full flex flex-col items-center gap-8 px-4 z-20">
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={startInteraction}
            disabled={appState.isConnected}
            className={`group relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-[800ms] cubic-bezier(0.34, 1.56, 0.64, 1) ${
              appState.isConnected 
                ? 'bg-orange-600 scale-90 ring-8 ring-orange-500/10 shadow-[0_0_30px_rgba(255,100,0,0.4)]' 
                : 'bg-white hover:bg-orange-500 scale-100 hover:rotate-12 shadow-[0_0_50px_rgba(255,255,255,0.2)]'
            }`}
          >
            {appState.isConnected ? (
              <div className="flex gap-1.5 items-center">
                <span className="w-1.5 h-6 bg-white rounded-full animate-[vibe_0.8s_infinite_0s]" />
                <span className="w-1.5 h-10 bg-white rounded-full animate-[vibe_0.8s_infinite_0.2s]" />
                <span className="w-1.5 h-6 bg-white rounded-full animate-[vibe_0.8s_infinite_0.4s]" />
              </div>
            ) : (
              <i className="fa-solid fa-wand-sparkles text-black text-3xl group-hover:text-white transition-colors" />
            )}
            
            {appState.isConnected && (
              <div className="absolute inset-[-12px] border-2 border-dashed border-orange-400/40 rounded-full animate-[spin_10s_linear_infinite]" />
            )}
          </button>
          
          <div className="text-[11px] uppercase tracking-[0.4em] text-orange-400 font-bold drop-shadow-[0_0_8px_rgba(255,165,0,0.4)] transition-opacity duration-500">
            {appState.isConnected ? 'Synchronized' : 'Awaken the Soul'}
          </div>
        </div>

        <div className="flex gap-6 items-center opacity-40 hover:opacity-100 transition-opacity">
           <div className="flex gap-2 items-center">
             <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-500 ${isFaceDetected ? 'bg-green-400 shadow-[0_0_10px_#4ade80]' : 'bg-red-500'}`} />
             <p className="text-[9px] text-gray-400 font-bold tracking-[0.2em]">FACIAL LOCK</p>
           </div>
           <div className="w-[1px] h-4 bg-gray-800" />
           <p className="text-[9px] text-gray-400 font-bold tracking-[0.2em]">EMOTIVE ENGINE</p>
        </div>
      </div>

      <div className="absolute inset-0 border-[30px] border-black pointer-events-none z-10" />
      <div className="absolute top-12 left-12 border-t border-l border-orange-500/10 w-24 h-24" />
      <div className="absolute top-12 right-12 border-t border-r border-orange-500/10 w-24 h-24" />
      <div className="absolute bottom-12 left-12 border-b border-l border-orange-500/10 w-24 h-24" />
      <div className="absolute bottom-12 right-12 border-b border-r border-orange-500/10 w-24 h-24" />

      <style>{`
        @keyframes vibe {
          0%, 100% { transform: scaleY(1); opacity: 0.6; }
          50% { transform: scaleY(1.4); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default App;
