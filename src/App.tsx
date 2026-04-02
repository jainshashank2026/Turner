import { useState, useEffect, useRef, useCallback, PointerEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PawPrint, Hand, Download } from 'lucide-react';
import { playTouchSound, startCountingSound, stopCountingSound, playWinnerSound } from './utils/sound';

interface TouchPoint {
  id: number;
  x: number;
  y: number;
  color: string;
}

const COLORS = [
  '#FF9E9E', // Vibrant Pastel Red/Pink
  '#FFB86F', // Vibrant Pastel Orange
  '#FFF07C', // Vibrant Pastel Yellow
  '#85FFC7', // Vibrant Pastel Green
  '#7EE8FA', // Vibrant Pastel Cyan
  '#9D94FF', // Vibrant Pastel Blue
  '#D499FF', // Vibrant Pastel Purple
  '#FF99E6', // Vibrant Pastel Magenta
];

interface BgPaw {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
}

const BackgroundPaws = () => {
  const [paws, setPaws] = useState<BgPaw[]>([]);

  useEffect(() => {
    const generatePaw = (id: number, existing: BgPaw[]) => {
      let x = 0, y = 0, isValid = false;
      let attempts = 0;
      while (!isValid && attempts < 50) {
        x = Math.random() * 80 + 10;
        y = Math.random() * 80 + 10;
        isValid = true;
        for (const p of existing) {
          const dx = p.x - x;
          const dy = p.y - y;
          if (Math.sqrt(dx * dx + dy * dy) < 20) {
            isValid = false;
            break;
          }
        }
        attempts++;
      }
      return {
        id,
        x,
        y,
        rotation: Math.random() * 360,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    };

    let currentPaws: BgPaw[] = [];
    for (let i = 0; i < 6; i++) {
      currentPaws.push(generatePaw(i, currentPaws));
    }
    setPaws(currentPaws);

    const interval = setInterval(() => {
      setPaws((current) => {
        const newPaws = [...current];
        const indexToReplace = Math.floor(Math.random() * newPaws.length);
        const others = newPaws.filter((_, i) => i !== indexToReplace);
        newPaws[indexToReplace] = generatePaw(Date.now(), others);
        return newPaws;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      key="waiting-ui"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
    >
      <AnimatePresence>
        {paws.map((paw) => (
          <motion.div
            key={paw.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 0.2, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute"
            style={{
              left: `${paw.x}%`,
              top: `${paw.y}%`,
              rotate: `${paw.rotation}deg`,
              color: paw.color,
              marginLeft: '-40px',
              marginTop: '-40px'
            }}
          >
            <PawPrint size={80} className="drop-shadow-lg" />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [touches, setTouches] = useState<TouchPoint[]>([]);
  const [status, setStatus] = useState<'waiting' | 'counting' | 'selected'>('waiting');
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [timerKey, setTimerKey] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevTouchesLength = useRef(0);

  useEffect(() => {
    // Simulate initial loading for splash screen
    const timer = setTimeout(() => setIsLoading(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
  };

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
    stopCountingSound();
    setStatus('waiting');
    setWinnerId(null);
  }, []);

  const handlePointerDown = (e: PointerEvent) => {
    if (status === 'selected' || isLoading) return;

    playTouchSound(touches.length);

    const usedColors = touches.map(t => t.color);
    const availableColors = COLORS.filter(c => !usedColors.includes(c));
    const colorToUse = availableColors.length > 0 
      ? availableColors[Math.floor(Math.random() * availableColors.length)] 
      : COLORS[Math.floor(Math.random() * COLORS.length)];

    const newTouch: TouchPoint = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      color: colorToUse,
    };

    setTouches((prev) => [...prev, newTouch]);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (status === 'selected' || isLoading) return;
    setTouches((prev) =>
      prev.map((t) => (t.id === e.pointerId ? { ...t, x: e.clientX, y: e.clientY } : t))
    );
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (isLoading) return;
    
    if (status === 'selected') {
      if (e.pointerId === winnerId) {
        // Wait 2s then reset, keeping the winner's circle visible during the delay
        if (!resetTimeoutRef.current) {
          resetTimeoutRef.current = setTimeout(() => {
            setTouches([]);
            reset();
            resetTimeoutRef.current = null;
          }, 2000);
        }
      } else {
        // Non-winner removed finger, just remove them from touches
        setTouches((prev) => prev.filter((t) => t.id !== e.pointerId));
      }
      return;
    }

    setTouches((prev) => prev.filter((t) => t.id !== e.pointerId));
  };

  useEffect(() => {
    if (isLoading || status === 'selected') {
      prevTouchesLength.current = touches.length;
      return;
    }

    if (touches.length !== prevTouchesLength.current) {
      if (touches.length > 1) {
        if (status !== 'counting') {
          setStatus('counting');
        }
        startCountingSound(); // Restart sound whenever the timer resets
        setTimerKey(prev => prev + 1); // Reset the 4s animation
        
        if (timerRef.current) clearTimeout(timerRef.current);
        
        timerRef.current = setTimeout(() => {
          setTouches((currentTouches) => {
            if (currentTouches.length > 1) {
              const randomIndex = Math.floor(Math.random() * currentTouches.length);
              setWinnerId(currentTouches[randomIndex].id);
              setStatus('selected');
              playWinnerSound();
            }
            return currentTouches;
          });
          timerRef.current = null;
        }, 4000);
      } else if (touches.length === 1) {
        if (timerRef.current) clearTimeout(timerRef.current);
        stopCountingSound();
        setStatus('waiting');
      } else {
        stopCountingSound();
        reset();
      }
      prevTouchesLength.current = touches.length;
    }

    return () => {
      // Don't clear timer here to avoid resetting on re-renders
    };
  }, [touches.length, status, isLoading, reset]);

  return (
    <div
      className="relative w-full h-screen bg-neutral-950 overflow-hidden touch-none select-none flex flex-col items-center justify-center"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {deferredPrompt && !isLoading && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleInstallClick();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-4 right-4 z-[60] bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-2 transition-colors border border-white/10 shadow-lg"
        >
          <Download size={18} />
          <span className="text-sm font-medium">Install App</span>
        </button>
      )}

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-neutral-950"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
              className="relative"
            >
              <div className="absolute inset-0 bg-white/20 blur-3xl rounded-full" />
              <div className="relative bg-neutral-900 p-8 rounded-full border border-white/10 shadow-2xl">
                <Hand size={80} className="text-white animate-pulse" />
              </div>
            </motion.div>
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="mt-8 text-6xl font-black text-white tracking-tighter"
            >
              TURNER
            </motion.h1>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 200 }}
              transition={{ delay: 0.8, duration: 1.2, ease: "easeInOut" }}
              className="mt-6 h-1 bg-white rounded-full"
            />
          </motion.div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              {status === 'waiting' && touches.length === 0 && <BackgroundPaws />}
            </AnimatePresence>

            {touches.map((touch) => {
              const isWinner = winnerId === touch.id;
              const isLoser = winnerId !== null && !isWinner;

              if (status === 'selected' && isLoser) return null;

              return (
                <motion.div
                  key={touch.id}
                  initial={{ scale: 0, opacity: 0, rotate: -90, x: touch.x - 60, y: touch.y - 60 }}
                  animate={{
                    scale: isWinner ? 1.5 : 1.2,
                    opacity: 1,
                    rotate: 0,
                    x: touch.x - 60,
                    y: touch.y - 60,
                  }}
                  transition={{ type: 'spring', damping: 15, stiffness: 400 }}
                  className="fixed top-0 left-0 w-[120px] h-[120px] pointer-events-none z-20"
                  style={{ color: touch.color }}
                >
                  {status === 'waiting' && (
                    <motion.div
                      animate={{ scale: [1, 2], opacity: [0.6, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                      className="absolute inset-0 rounded-full border-4 border-current shadow-[0_0_20px_currentColor]"
                    />
                  )}

                  {status === 'counting' && (
                    <motion.div
                      key={timerKey}
                      animate={{ scale: [1, 4], opacity: [0.8, 0.1] }}
                      transition={{ duration: 4, ease: "linear" }}
                      className="absolute inset-0 rounded-full border-4 border-current shadow-[0_0_20px_currentColor]"
                    />
                  )}

                  {status === 'selected' && isWinner && (
                    <motion.div
                      initial={{ scale: 4, opacity: 0, boxShadow: `0 0 0 0px #0a0a0a, 0 0 0 0px ${touch.color}` }}
                      animate={{ scale: 1.3, opacity: 1, boxShadow: `0 0 0 30px #0a0a0a, 0 0 0 4000px ${touch.color}` }}
                      transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
                      className="absolute inset-0 rounded-full border-8 border-current"
                    />
                  )}
                  
                  <div 
                    className="absolute inset-2 rounded-full bg-current shadow-[0_0_40px_currentColor] flex items-center justify-center"
                    style={{ backgroundColor: touch.color }}
                  >
                    <PawPrint size={56} className="text-black/60" />
                  </div>
                </motion.div>
              );
            })}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
