export const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  
  // Singleton pattern for AudioContext
  if (!(window as any).__audioCtx) {
    (window as any).__audioCtx = new AudioContextClass();
  }
  return (window as any).__audioCtx as AudioContext;
};

export const playTouchSound = (index: number = 0) => {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  // Pentatonic scale starting at C4
  const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
  const freq = notes[index % notes.length];
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  
  // Piano-like envelope: quick attack, long exponential decay
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start();
  osc.stop(ctx.currentTime + 1.5);
};

let countingOsc: OscillatorNode | null = null;
let countingGain: GainNode | null = null;

export const startCountingSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  
  stopCountingSound();
  
  countingOsc = ctx.createOscillator();
  countingGain = ctx.createGain();
  
  countingOsc.type = 'sine';
  // Sweep from C3 to G3 over exactly 4 seconds
  countingOsc.frequency.setValueAtTime(130.81, ctx.currentTime);
  countingOsc.frequency.exponentialRampToValueAtTime(196.00, ctx.currentTime + 4);
  
  countingGain.gain.setValueAtTime(0, ctx.currentTime);
  countingGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1);
  
  countingOsc.connect(countingGain);
  countingGain.connect(ctx.destination);
  
  countingOsc.start();
};

export const stopCountingSound = (fadeTime = 0.1) => {
  const ctx = getAudioContext();
  if (!ctx || !countingOsc || !countingGain) return;
  
  try {
    // Cancel scheduled values to prevent clicks and crossfade smoothly
    countingGain.gain.cancelScheduledValues(ctx.currentTime);
    countingGain.gain.setValueAtTime(countingGain.gain.value || 0.15, ctx.currentTime);
    countingGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeTime);
    countingOsc.stop(ctx.currentTime + fadeTime);
  } catch (e) {
    // Ignore errors if already stopped
  }
  
  countingOsc = null;
  countingGain = null;
};

export const playWinnerSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  
  // Quick 50ms crossfade to blend the counting sound into the winner chime
  stopCountingSound(0.05);
  
  // Playful arpeggio that picks up EXACTLY where the counting sound left off (G3)
  // G3, C4, E4, G4 (V -> I resolution)
  const notes = [196.00, 261.63, 329.63, 392.00];
  const startTime = ctx.currentTime;
  
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Make the final note a bit brighter
    osc.type = i === notes.length - 1 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, startTime + i * 0.08);
    
    // Bouncy envelope
    gain.gain.setValueAtTime(0, startTime + i * 0.08);
    gain.gain.linearRampToValueAtTime(0.2, startTime + i * 0.08 + 0.02);
    
    if (i === notes.length - 1) {
      // Last note rings out longer
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + i * 0.08 + 2.5);
      osc.start(startTime + i * 0.08);
      osc.stop(startTime + i * 0.08 + 2.5);
    } else {
      // Short staccato notes for the run-up, slightly longer decay for better blending
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + i * 0.08 + 0.3);
      osc.start(startTime + i * 0.08);
      osc.stop(startTime + i * 0.08 + 0.3);
    }
    
    osc.connect(gain);
    gain.connect(ctx.destination);
  });
};
