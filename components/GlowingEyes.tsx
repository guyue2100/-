
import React from 'react';
import { EyeExpression, LookTarget } from '../types';

interface GlowingEyesProps {
  expressionLeft: EyeExpression;
  expressionRight: EyeExpression;
  lookAt: LookTarget;
  isTracking: boolean;
}

const GlowingEyes: React.FC<GlowingEyesProps> = ({ expressionLeft, expressionRight, lookAt, isTracking }) => {
  const getEyeStyle = (expr: EyeExpression) => {
    switch (expr) {
      case 'happy': // 喜 - Upward curve
        return 'scale-y-[0.7] translate-y-4 rounded-t-[110%] rounded-b-[40%]';
      case 'angry': // 怒 - Sharp downward angle
        return 'rotate-[-22deg] scale-x-115 brightness-150 saturate-150 shadow-[0_0_140px_rgba(255,69,0,1)]';
      case 'sad': // 哀 - Droopy outward angle
        return 'rotate-[18deg] translate-y-4 opacity-80 scale-90 grayscale-[0.2]';
      case 'joyful': // 乐 - Deep happy curve (n shape)
        return 'scale-y-[0.5] translate-y-6 rounded-t-[120%] rounded-b-[20%] brightness-125';
      case 'surprised': // 惊 - Wide circles with small pupils
      case 'wide': 
        return 'scale-130 shadow-[0_0_150px_rgba(255,200,0,1)]';
      case 'love': // Extra cute love state
        return 'scale-110 rounded-[45%] rotate-[5deg] shadow-[0_0_130px_rgba(255,105,180,0.6)]';
      case 'smile': 
        return 'scale-y-[0.65] translate-y-4 rounded-t-[100%] rounded-b-[40%]';
      case 'slit': 
        return 'scale-y-[0.08] scale-x-125';
      case 'tiny': 
        return 'scale-[0.6]';
      case 'thinking':
        return 'translate-y-[-15px] scale-x-90 rotate-[-8deg]';
      case 'blink': 
        // Horizontal line style for blinking
        return 'scale-y-[0.05] scale-x-110 rounded-full shadow-[0_0_80px_rgba(255,140,0,1)]';
      default: 
        return 'scale-100';
    }
  };

  const getPupilStyle = (expr: EyeExpression) => {
    let base = 'transition-all duration-700 ';
    if (expr === 'surprised' || expr === 'tiny') base += 'scale-[0.35] ';
    if (expr === 'wide') base += 'scale-[1.2] ';
    if (expr === 'joyful' || expr === 'happy') base += 'scale-y-[1.5] scale-x-[0.9] ';
    if (expr === 'angry') base += 'scale-x-[1.4] scale-y-[0.8] ';
    if (isTracking && expr === 'neutral') base += 'scale-[1.1] ';
    return base;
  };

  const pupilTransform = `translate(${lookAt.x * 38}px, ${lookAt.y * 28}px)`;
  const foreshortening = `scale(${1 - Math.abs(lookAt.x) * 0.18}, ${1 - Math.abs(lookAt.y) * 0.18})`;

  const Eye = ({ expr }: { expr: EyeExpression }) => (
    <div 
      className={`relative w-36 h-36 md:w-56 md:h-56 bg-orange-400 rounded-full 
        transition-all duration-[700ms] cubic-bezier(0.34, 1.56, 0.64, 1.2)
        ${getEyeStyle(expr)}
        shadow-[0_0_120px_rgba(255,140,0,1),0_0_40px_rgba(255,100,0,0.8),inset_0_0_50px_rgba(255,255,255,0.8)]
        overflow-hidden flex items-center justify-center`}
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none" />
      
      {/* Only show pupil/glints if not blinking */}
      {expr !== 'blink' && (
        <div 
          className="absolute inset-0 flex items-center justify-center transition-transform duration-[200ms] ease-out"
          style={{ transform: `${pupilTransform} ${foreshortening}` }}
        >
          {/* Main Pupil */}
          <div className={`w-18 h-18 md:w-32 md:h-32 bg-black rounded-full opacity-95 shadow-[inset_0_0_25px_rgba(255,100,0,0.5)] blur-[0.2px] transition-transform duration-500 ${getPupilStyle(expr)}`} />
          
          {/* Glints / Sparkles */}
          <div className="absolute top-8 left-8 w-7 h-7 bg-white rounded-full opacity-75 blur-[1px] animate-pulse" />
          <div className="absolute bottom-14 right-14 w-4 h-4 bg-white rounded-full opacity-40 blur-[1px]" />
          
          {/* Extra "Love" glint */}
          {expr === 'joyful' && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-20 bg-[radial-gradient(circle,white_10%,transparent_70%)]" />
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative flex items-center justify-center gap-8 md:gap-56 w-full h-full select-none pointer-events-none">
      
      {/* Tracking HUD */}
      {isTracking && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div 
            className="w-[350px] h-[350px] md:w-[700px] md:h-[500px] border border-orange-500/10 rounded-full transition-transform duration-500 ease-out"
            style={{ transform: `translate(${lookAt.x * 25}px, ${lookAt.y * 20}px) scale(1.05)` }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-orange-500/40" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-orange-500/40" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 bg-orange-500/40" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-6 bg-orange-500/40" />
          </div>
        </div>
      )}

      {/* Atmospheric Glow */}
      <div className="absolute inset-0 flex items-center justify-center opacity-40">
         <div className="w-[800px] h-[800px] bg-orange-800/20 rounded-full blur-[220px] animate-[pulse_6s_infinite]" />
      </div>

      {/* Floating Dust */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div 
            key={i}
            className="absolute w-[3px] h-[3px] bg-orange-200 rounded-full opacity-10 animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${15 + Math.random() * 20}s`
            }}
          />
        ))}
      </div>

      <div className="transform transition-transform duration-700" style={{ transform: `rotate(${lookAt.x * 10}deg)` }}>
        <Eye expr={expressionLeft} />
      </div>
      <div className="transform transition-transform duration-700" style={{ transform: `rotate(${lookAt.x * 10}deg)` }}>
        <Eye expr={expressionRight} />
      </div>

      <style>{`
        @keyframes float {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 0.2; }
          90% { opacity: 0.1; }
          100% { transform: translateY(-400px) scale(0); opacity: 0; }
        }
        .animate-float {
          animation: float linear infinite;
        }
      `}</style>
    </div>
  );
};

export default GlowingEyes;
