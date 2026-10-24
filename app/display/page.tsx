"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BoardCard } from "@/components/BoardCard";
import { ScoreCard } from "@/components/ScoreCard";
import { questions } from "@/data/questions";
import { useGameState } from "@/hooks/useGameState";

/* ================================================================== */
/* Audio engine (Web Audio synth: playful background music + SFX)      */
/* ================================================================== */

type ToneOpts = {
  at: number;
  freq: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  slideTo?: number;
  attack?: number;
};

function tone(ctx: AudioContext, dest: AudioNode, o: ToneOpts) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, o.at);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, o.at + o.dur);
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.exponentialRampToValueAtTime(o.gain, o.at + (o.attack ?? 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(o.at);
  osc.stop(o.at + o.dur + 0.05);
}

function noise(
  ctx: AudioContext,
  dest: AudioNode,
  buf: AudioBuffer,
  o: { at: number; dur: number; gain: number; type: BiquadFilterType; f0: number; f1?: number }
) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = o.type;
  filter.frequency.setValueAtTime(o.f0, o.at);
  if (o.f1) filter.frequency.exponentialRampToValueAtTime(o.f1, o.at + o.dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.exponentialRampToValueAtTime(o.gain, o.at + Math.min(0.02, o.dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(dest);
  src.start(o.at);
  src.stop(o.at + o.dur + 0.05);
}

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// 4 bars of 16 steps — C, Am, F, G (bouncy, mild, major-key)
const MELODY: (number | null)[][] = [
  [79, null, 76, null, 72, null, 76, 79, 84, null, 79, null, 76, null, null, null],
  [81, null, 76, null, 72, null, 76, 81, 84, null, 81, null, 76, null, null, null],
  [77, null, 81, null, 84, null, 81, 77, 72, null, 77, null, 81, null, null, null],
  [74, null, 79, null, 83, null, 79, 74, 79, null, 76, 74, 72, null, null, null],
];
const BASS_ROOT = [48, 45, 41, 43]; // C3, A2, F2, G2
const CHORDS = [
  [60, 64, 67],
  [57, 60, 64],
  [60, 65, 69],
  [59, 62, 67],
];

function createAudioEngine() {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();

  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  const musicGain = ctx.createGain();
  musicGain.gain.value = 0.25;
  musicGain.connect(master);

  const sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.8;
  sfxGain.connect(master);

  // 1s white noise buffer
  const nBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = nBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  let timer: ReturnType<typeof setInterval> | null = null;

  const BPM = 108;
  const stepDur = 60 / BPM / 4;

  function scheduleStep(step: number, t: number) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;

    // Melody (soft triangle "marimba")
    const m = MELODY[bar][s];
    if (m !== null) {
      tone(ctx, musicGain, { at: t, freq: midi(m), dur: 0.24, gain: 0.1, type: "triangle", attack: 0.004 });
      tone(ctx, musicGain, { at: t, freq: midi(m + 12), dur: 0.1, gain: 0.02, type: "sine" });
    }

    // Bouncy bass
    if (s === 0 || s === 8) {
      tone(ctx, musicGain, { at: t, freq: midi(BASS_ROOT[bar]), dur: 0.32, gain: 0.2, type: "sine" });
    } else if (s === 6 || s === 14) {
      tone(ctx, musicGain, { at: t, freq: midi(BASS_ROOT[bar] + 12), dur: 0.16, gain: 0.1, type: "sine" });
    }

    // Soft chord stabs on the off-beats
    if (s === 4 || s === 12) {
      CHORDS[bar].forEach((n) =>
        tone(ctx, musicGain, { at: t, freq: midi(n), dur: 0.16, gain: 0.035, type: "triangle" })
      );
    }

    // Soft kick
    if (s === 0 || s === 8) {
      tone(ctx, musicGain, { at: t, freq: 130, slideTo: 45, dur: 0.14, gain: 0.16, type: "sine" });
    }

    // Light hats / shaker
    if (s % 2 === 0) {
      noise(ctx, musicGain, nBuf, {
        at: t,
        dur: 0.035,
        gain: s % 4 === 2 ? 0.05 : 0.03,
        type: "highpass",
        f0: 7000,
      });
    }
  }

  return {
    ctx,
    startMusic() {
      if (timer) return;
      let step = 0;
      let next = ctx.currentTime + 0.15;
      timer = setInterval(() => {
        while (next < ctx.currentTime + 0.25) {
          scheduleStep(step, next);
          next += stepDur;
          step = (step + 1) % 64;
        }
      }, 40);
    },
    stopMusic() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    setMusicVolume(v: number) {
      musicGain.gain.setTargetAtTime((v / 100) * 0.5, ctx.currentTime, 0.1);
    },
    duck(ms = 1800) {
      const t = ctx.currentTime;
      musicGain.gain.cancelScheduledValues(t);
      musicGain.gain.setTargetAtTime(musicGain.gain.value * 0.35, t, 0.05);
      return ms;
    },

    /* ---------------- sound effects ---------------- */
    reveal() {
      const t = ctx.currentTime;
      [76, 83, 88, 95].forEach((n, i) =>
        tone(ctx, sfxGain, { at: t + i * 0.05, freq: midi(n + 12), dur: 0.35, gain: 0.12, type: "sine" })
      );
      noise(ctx, sfxGain, nBuf, { at: t, dur: 0.3, gain: 0.08, type: "highpass", f0: 3000, f1: 9000 });
    },
    strike() {
      const t = ctx.currentTime;
      tone(ctx, sfxGain, { at: t, freq: 160, slideTo: 55, dur: 0.6, gain: 0.35, type: "sawtooth" });
      tone(ctx, sfxGain, { at: t, freq: 80, slideTo: 40, dur: 0.7, gain: 0.35, type: "sine" });
      noise(ctx, sfxGain, nBuf, { at: t, dur: 0.4, gain: 0.25, type: "lowpass", f0: 1800, f1: 120 });
    },
    buzzIn() {
      const t = ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        tone(ctx, sfxGain, { at: t + i * 0.12, freq: 520, dur: 0.1, gain: 0.18, type: "square" });
        tone(ctx, sfxGain, { at: t + i * 0.12 + 0.06, freq: 780, dur: 0.08, gain: 0.12, type: "square" });
      }
    },
    whoosh() {
      const t = ctx.currentTime;
      noise(ctx, sfxGain, nBuf, { at: t, dur: 0.55, gain: 0.2, type: "bandpass", f0: 300, f1: 4500 });
      tone(ctx, sfxGain, { at: t + 0.35, freq: midi(84), dur: 0.25, gain: 0.08, type: "triangle" });
    },
    bankTick() {
      const t = ctx.currentTime;
      tone(ctx, sfxGain, { at: t, freq: midi(88), dur: 0.08, gain: 0.1, type: "square" });
      tone(ctx, sfxGain, { at: t + 0.07, freq: midi(95), dur: 0.18, gain: 0.1, type: "square" });
    },
    scoreUp() {
      const t = ctx.currentTime;
      [72, 76, 79, 84, 88].forEach((n, i) =>
        tone(ctx, sfxGain, { at: t + i * 0.07, freq: midi(n), dur: 0.22, gain: 0.12, type: "triangle" })
      );
    },
    fanfare() {
      const t = ctx.currentTime;
      const seq: [number, number, number][] = [
        [72, 0, 0.18],
        [72, 0.2, 0.18],
        [72, 0.4, 0.18],
        [76, 0.6, 0.3],
        [72, 0.95, 0.2],
        [76, 1.2, 0.2],
        [79, 1.45, 0.9],
      ];
      seq.forEach(([n, off, dur]) => {
        tone(ctx, sfxGain, { at: t + off, freq: midi(n), dur, gain: 0.2, type: "sawtooth" });
        tone(ctx, sfxGain, { at: t + off, freq: midi(n - 12), dur, gain: 0.12, type: "square" });
      });
      [60, 64, 67, 72].forEach((n) =>
        tone(ctx, sfxGain, { at: t + 1.45, freq: midi(n), dur: 1.4, gain: 0.1, type: "triangle" })
      );
      for (let i = 0; i < 10; i++) {
        noise(ctx, sfxGain, nBuf, {
          at: t + 1.45 + i * 0.12,
          dur: 0.1,
          gain: 0.07,
          type: "highpass",
          f0: 5000,
        });
      }
    },
    close() {
      this.stopMusic();
      void ctx.close();
    },
  };
}

type AudioEngine = ReturnType<typeof createAudioEngine>;

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */

function seeded(seed: number) {
  const x = Math.sin(seed * 9999.91) * 10000;
  return x - Math.floor(x);
}

function AnimatedScore({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const start = fromRef.current;
    const end = value;
    if (start === end) return;

    const duration = 800;
    const startTime = performance.now();
    let rafId: number;

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(start + (end - start) * easeOut);
      setDisplayValue(current);
      fromRef.current = current;
      if (progress < 1) rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [value]);

  return <>{displayValue}</>;
}

function usePulse(value: number, ms = 900) {
  const [pulse, setPulse] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), ms);
    return () => clearTimeout(t);
  }, [value, ms]);

  return pulse;
}

function useTypewriter(text: string, speed = 22) {
  const [out, setOut] = useState(text);

  useEffect(() => {
    setOut("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return out;
}

const CONFETTI_COLORS = ["#facc15", "#fde047", "#60a5fa", "#f87171", "#ffffff", "#fb923c", "#a78bfa"];

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */

export default function DisplayPage() {
  const { gameState, sfxTrigger, connected } = useGameState();
  const [audioStarted, setAudioStarted] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [strikeFlash, setStrikeFlash] = useState<number | null>(null);
  const [revealBurst, setRevealBurst] = useState<{ id: number; points: number | null } | null>(null);

  const engine = useRef<AudioEngine | null>(null);
  const lastSfx = useRef(0);
  const lastBuzzer = useRef(0);
  const prevStrikes = useRef(gameState.strikes);
  const prevRevealed = useRef<boolean[]>([]);
  const prevQuestion = useRef(gameState.currentQuestionIndex);
  const prevBank = useRef(gameState.roundBank);
  const prevScoreA = useRef(gameState.teamAScore);
  const prevScoreB = useRef(gameState.teamBScore);
  const prevGameOver = useRef(gameState.gameOver);

  const question = questions[gameState.currentQuestionIndex] ?? questions[0];
  const winnerLabel =
    gameState.winner === "tie"
      ? "IT'S A TIE!"
      : gameState.winner
        ? `TEAM ${gameState.winner} WINS!`
        : "";
  const musicVolume = Math.max(0, Math.min(100, gameState.musicVolume));
  const musicVolumeRef = useRef(musicVolume);

  const typedPrompt = useTypewriter(question.prompt);
  const scoreAPulse = usePulse(gameState.teamAScore);
  const scoreBPulse = usePulse(gameState.teamBScore);
  const bankPulse = usePulse(gameState.roundBank, 700);

  const sparkles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: seeded(i + 1) * 100,
        size: 2 + seeded(i + 40) * 4,
        delay: seeded(i + 80) * 8,
        duration: 7 + seeded(i + 120) * 9,
      })),
    []
  );

  const confetti = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        left: seeded(i + 200) * 100,
        delay: seeded(i + 300) * 2.5,
        duration: 3 + seeded(i + 400) * 3,
        size: 8 + seeded(i + 500) * 10,
        color: CONFETTI_COLORS[Math.floor(seeded(i + 600) * CONFETTI_COLORS.length)],
        spin: 360 + seeded(i + 700) * 720,
        drift: (seeded(i + 800) - 0.5) * 240,
      })),
    []
  );

  /* ---------------- Start show (must be inside a user gesture) ---------------- */
  const startShow = () => {
    if (!engine.current) {
      engine.current = createAudioEngine();
    }
    void engine.current.ctx.resume();
    engine.current.setMusicVolume(musicVolumeRef.current);
    engine.current.startMusic();
    engine.current.whoosh();
    setAudioStarted(true);
  };

  useEffect(() => {
    return () => {
      engine.current?.close();
      engine.current = null;
    };
  }, []);

  /* ---------------- Sound effects from controller ---------------- */
  useEffect(() => {
    if (!audioStarted || !sfxTrigger.timestamp || sfxTrigger.timestamp === lastSfx.current) return;
    lastSfx.current = sfxTrigger.timestamp;
    const source =
      sfxTrigger.sound === "ding"
        ? "/ding.mp3"
        : sfxTrigger.sound === "strike"
          ? "/strike.mp3"
          : "/buzzer.mp3";
    void new Audio(source).play().catch(() => undefined);
  }, [audioStarted, sfxTrigger]);

  useEffect(() => {
    const buzzerTimestamp = gameState.buzzerStatus.timestamp;
    if (!audioStarted || !buzzerTimestamp || buzzerTimestamp === lastBuzzer.current) return;
    lastBuzzer.current = buzzerTimestamp;
    void new Audio("/buzzer.mp3").play().catch(() => undefined);
    engine.current?.buzzIn();
  }, [audioStarted, gameState.buzzerStatus.timestamp]);

  /* ---------------- Strike: shake + slam + synth thud ---------------- */
  useEffect(() => {
    if (gameState.strikes > prevStrikes.current) {
      const id = Date.now();
      setStrikeFlash(id);
      setScreenShake(true);
      engine.current?.strike();
      const t1 = setTimeout(() => setScreenShake(false), 650);
      const t2 = setTimeout(() => setStrikeFlash(null), 1900);
      prevStrikes.current = gameState.strikes;
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    prevStrikes.current = gameState.strikes;
  }, [gameState.strikes]);

  /* ---------------- Reveal: burst + sparkle sound ---------------- */
  useEffect(() => {
    const current = question.answers.map((_, i) => Boolean(gameState.revealedAnswers[i]));
    const prev = prevRevealed.current;
    const newIndex = current.findIndex((v, i) => v && !prev[i]);
    prevRevealed.current = current;

    if (newIndex !== -1 && prev.length === current.length) {
      const raw = question.answers[newIndex] as unknown as Record<string, unknown>;
      const value = raw.points ?? raw.score;
      setRevealBurst({ id: Date.now(), points: typeof value === "number" ? value : null });
      engine.current?.reveal();
      const t = setTimeout(() => setRevealBurst(null), 1600);
      return () => clearTimeout(t);
    }
  }, [gameState.revealedAnswers, question]);

  /* ---------------- New question whoosh ---------------- */
  useEffect(() => {
    if (prevQuestion.current !== gameState.currentQuestionIndex) {
      prevQuestion.current = gameState.currentQuestionIndex;
      engine.current?.whoosh();
    }
  }, [gameState.currentQuestionIndex]);

  /* ---------------- Bank / score blips ---------------- */
  useEffect(() => {
    if (gameState.roundBank > prevBank.current) engine.current?.bankTick();
    prevBank.current = gameState.roundBank;
  }, [gameState.roundBank]);

  useEffect(() => {
    if (gameState.teamAScore > prevScoreA.current) engine.current?.scoreUp();
    prevScoreA.current = gameState.teamAScore;
  }, [gameState.teamAScore]);

  useEffect(() => {
    if (gameState.teamBScore > prevScoreB.current) engine.current?.scoreUp();
    prevScoreB.current = gameState.teamBScore;
  }, [gameState.teamBScore]);

  /* ---------------- Winner fanfare ---------------- */
  useEffect(() => {
    if (gameState.gameOver && !prevGameOver.current) {
      engine.current?.fanfare();
    }
    prevGameOver.current = gameState.gameOver;
  }, [gameState.gameOver]);

  /* ---------------- Music volume (controller slider) ---------------- */
  useEffect(() => {
    musicVolumeRef.current = musicVolume;
    engine.current?.setMusicVolume(musicVolume);
  }, [musicVolume]);

  const rowCount = Math.ceil(question.answers.length / 2);
  const buzzWinner = gameState.buzzerStatus.locked ? gameState.buzzerStatus.winner : null;

  return (
    <main
      className={`relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#04081a] px-[2vw] py-[1.5vh] text-white select-none ${
        screenShake ? "animate-[shake_0.55s_ease-in-out]" : ""
      }`}
    >
      {/* ------------------------------------------------------------ */}
      {/* Animations & styles                                           */}
      {/* ------------------------------------------------------------ */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          15% { transform: translate(-18px, -12px) rotate(-1.6deg); }
          30% { transform: translate(18px, 10px) rotate(1.6deg); }
          45% { transform: translate(-14px, 14px) rotate(-1.1deg); }
          60% { transform: translate(14px, -10px) rotate(1deg); }
          75% { transform: translate(-6px, 4px) rotate(-0.5deg); }
        }
        @keyframes strike-bg {
          0% { opacity: 0; }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes strike-slam {
          0% { transform: scale(4) rotate(-12deg); opacity: 0; }
          18% { transform: scale(0.88) rotate(2deg); opacity: 1; }
          28% { transform: scale(1.06) rotate(-1deg); opacity: 1; }
          38%, 82% { transform: scale(1) rotate(0deg); opacity: 1; }
          100% { transform: scale(1.25); opacity: 0; }
        }
        @keyframes buzzer-flash {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.04); filter: brightness(1.35); }
        }
        @keyframes buzz-pop {
          0% { transform: scale(.3) rotate(-6deg); opacity: 0; }
          55% { transform: scale(1.12) rotate(1deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes buzzer-ring {
          0% { transform: scale(0.98); opacity: 0.9; }
          100% { transform: scale(1.06); opacity: 0; }
        }
        @keyframes marquee-chase {
          0% { background-position: 0 0; }
          100% { background-position: 48px 0; }
        }
        @keyframes sunburst-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes beam-sweep-left {
          0%, 100% { transform: rotate(-18deg); opacity: .35; }
          50% { transform: rotate(14deg); opacity: .7; }
        }
        @keyframes beam-sweep-right {
          0%, 100% { transform: rotate(18deg); opacity: .35; }
          50% { transform: rotate(-14deg); opacity: .7; }
        }
        @keyframes float-up {
          0% { transform: translateY(0); opacity: 0; }
          15% { opacity: .9; }
          100% { transform: translateY(-110vh); opacity: 0; }
        }
        @keyframes pop {
          0% { transform: scale(1); }
          35% { transform: scale(1.22); }
          100% { transform: scale(1); }
        }
        @keyframes score-glow {
          0% { filter: brightness(1) drop-shadow(0 0 0 rgba(250,204,21,0)); transform: scale(1); }
          30% { filter: brightness(1.5) drop-shadow(0 0 28px rgba(250,204,21,.95)); transform: scale(1.12); }
          100% { filter: brightness(1) drop-shadow(0 0 0 rgba(250,204,21,0)); transform: scale(1); }
        }
        @keyframes question-in {
          0% { transform: translateY(24px) scale(.96); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes board-in {
          0% { transform: translateY(40px) scale(.94); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes shine {
          0% { transform: translateX(-130%) skewX(-20deg); }
          60%, 100% { transform: translateX(260%) skewX(-20deg); }
        }
        @keyframes ray-out {
          0% { transform: rotate(var(--a)) translateX(0) scaleX(.2); opacity: 1; }
          100% { transform: rotate(var(--a)) translateX(min(34vw, 420px)) scaleX(1.6); opacity: 0; }
        }
        @keyframes flash-ring {
          0% { transform: translate(-50%, -50%) scale(.2); opacity: .9; }
          100% { transform: translate(-50%, -50%) scale(3.4); opacity: 0; }
        }
        @keyframes points-toast {
          0% { transform: translate(-50%, 20px) scale(.4); opacity: 0; }
          20% { transform: translate(-50%, -10px) scale(1.25); opacity: 1; }
          35% { transform: translate(-50%, 0) scale(1); opacity: 1; }
          80% { transform: translate(-50%, -30px) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -80px) scale(.9); opacity: 0; }
        }
        @keyframes confetti-fall {
          0% { transform: translate3d(0, -12vh, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(var(--drift), 112vh, 0) rotate(var(--spin)); opacity: .9; }
        }
        @keyframes winner-in {
          0% { transform: scale(.4) rotate(-6deg); opacity: 0; }
          60% { transform: scale(1.08) rotate(1deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes winner-glow {
          0%, 100% { box-shadow: 0 0 80px rgba(250,204,21,.45); }
          50% { box-shadow: 0 0 170px rgba(250,204,21,.9); }
        }
        @keyframes splash-title {
          0% { transform: scale(.7); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes caret {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes light-sweep-border {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }

        .studio-grid {
          background-image:
            radial-gradient(circle at 50% 25%, rgba(29, 78, 216, 0.5) 0%, transparent 65%),
            linear-gradient(to bottom, rgba(4, 8, 26, 0.9), rgba(2, 4, 15, 0.98)),
            radial-gradient(rgba(250, 204, 21, 0.15) 1.5px, transparent 1.5px);
          background-size: 100% 100%, 100% 100%, 28px 28px;
        }
        .sunburst {
          position: fixed;
          top: 38%;
          left: 50%;
          width: 220vmax;
          height: 220vmax;
          background: repeating-conic-gradient(
            from 0deg,
            rgba(59, 130, 246, 0.10) 0deg 6deg,
            transparent 6deg 12deg
          );
          mask-image: radial-gradient(circle, black 0%, transparent 55%);
          -webkit-mask-image: radial-gradient(circle, black 0%, transparent 55%);
          animation: sunburst-spin 90s linear infinite;
          pointer-events: none;
          z-index: 0;
        }
        .marquee-lights {
          background-image: radial-gradient(circle, #fef08a 30%, #ca8a04 65%, transparent 70%);
          background-size: 24px 24px;
          animation: marquee-chase 1.2s linear infinite;
        }
        .gold-border {
          background: linear-gradient(90deg, #f59e0b, #fef08a, #f59e0b, #fef08a, #f59e0b);
          background-size: 200% 100%;
          animation: light-sweep-border 4s linear infinite;
        }
        .shine-layer::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,.35) 50%, transparent 70%);
          animation: shine 5s ease-in-out infinite;
          pointer-events: none;
        }
        .beam {
          position: fixed;
          top: -12vh;
          width: 26vw;
          height: 120vh;
          transform-origin: top center;
          filter: blur(22px);
          pointer-events: none;
          z-index: 0;
        }
        .sparkle {
          position: fixed;
          bottom: -10px;
          border-radius: 9999px;
          background: radial-gradient(circle, #fef9c3 0%, rgba(250,204,21,.6) 50%, transparent 70%);
          pointer-events: none;
          z-index: 0;
          animation: float-up linear infinite;
        }
        .confetti-piece {
          position: absolute;
          top: 0;
          border-radius: 2px;
          animation: confetti-fall linear infinite;
        }
        .ray {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 90px;
          height: 5px;
          border-radius: 9999px;
          background: linear-gradient(90deg, #fef08a, rgba(250,204,21,0));
          transform-origin: 0 50%;
          animation: ray-out .9s ease-out forwards;
        }
        .caret::after {
          content: "";
          display: inline-block;
          width: .08em;
          height: .9em;
          margin-left: .12em;
          vertical-align: -0.08em;
          background: #fde047;
          animation: caret .8s steps(1) infinite;
        }
        .answer-cell > * { height: 100%; }
        @media (prefers-reduced-motion: reduce) {
          .sunburst, .beam, .sparkle, .marquee-lights, .gold-border, .shine-layer::after {
            animation: none !important;
          }
        }
      `}</style>

      {/* ------------------------------------------------------------ */}
      {/* Studio background                                             */}
      {/* ------------------------------------------------------------ */}
      <div className="studio-grid pointer-events-none fixed inset-0 z-0" />
      <div className="sunburst" />
      <div
        className="beam left-[8%] bg-gradient-to-b from-blue-400/40 to-transparent"
        style={{ animation: "beam-sweep-left 9s ease-in-out infinite" }}
      />
      <div
        className="beam right-[8%] bg-gradient-to-b from-amber-300/35 to-transparent"
        style={{ animation: "beam-sweep-right 11s ease-in-out infinite" }}
      />
      <div className="pointer-events-none fixed -top-40 left-1/4 z-0 h-[550px] w-[550px] animate-pulse rounded-full bg-blue-600/20 blur-[130px]" />
      <div className="pointer-events-none fixed -top-40 right-1/4 z-0 h-[550px] w-[550px] animate-pulse rounded-full bg-amber-500/15 blur-[130px]" />

      {sparkles.map((s, i) => (
        <span
          key={i}
          className="sparkle"
          style={{
            left: `${s.left.toFixed(4)}%`,
            width: `${s.size.toFixed(4)}px`,
            height: `${s.size.toFixed(4)}px`,
            animationDuration: `${s.duration.toFixed(4)}s`,
            animationDelay: `${s.delay.toFixed(4)}s`,
          }}
        />
      ))}

      {/* ------------------------------------------------------------ */}
      {/* Start splash                                                  */}
      {/* ------------------------------------------------------------ */}
      {!audioStarted && (
  <button
    onClick={startShow}
    className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,#1e3a8a_0%,#0f172a_60%,#020617_100%)] transition-opacity duration-500"
  >
    <div className="sunburst pointer-events-none absolute inset-0 opacity-80 mix-blend-screen" />

    <div
      className="relative flex flex-col items-center justify-center rounded-[100%] border-[8px] border-yellow-400 bg-gradient-to-b from-blue-700 via-blue-900 to-blue-950 px-24 py-16 shadow-[0_0_100px_rgba(250,204,21,0.5),inset_0_0_60px_rgba(0,0,0,0.9)]"
      style={{ animation: "splash-title 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) both" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[100%] bg-gradient-to-b from-white/10 to-transparent" />

      <p className="text-center text-sm font-black tracking-[0.5em] text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
        WELCOME TO
      </p>

      <h1 className="mt-3 flex flex-col items-center bg-gradient-to-b from-white via-yellow-200 to-amber-500 bg-clip-text font-black leading-[0.9] tracking-tight text-transparent drop-shadow-[0_8px_8px_rgba(0,0,0,0.9)]">
        <span className="text-5xl sm:text-6xl mb-2">CHURCH</span>
        <span className="text-7xl sm:text-8xl">FAMILY</span>
        <span className="text-8xl sm:text-9xl">FEUD</span>
      </h1>
    </div>

    <div className="relative mt-16 animate-bounce rounded-full border-4 border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-700 px-16 py-5 text-3xl font-black tracking-widest text-blue-950 shadow-[0_15px_40px_rgba(245,158,11,0.7),inset_0_4px_10px_rgba(255,255,255,0.5)] transition-transform hover:scale-105">
      START SHOW
    </div>

    <span className="relative mt-6 text-sm font-bold tracking-[0.3em] text-blue-300/60 uppercase">
      Enables Audio & Stage Sound Effects
    </span>
  </button>
)}

      {/* ------------------------------------------------------------ */}
      {/* Header: team scores + round bank (fixed height)               */}
      {/* ------------------------------------------------------------ */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl shrink-0 items-center justify-between gap-4">
        <div
          key={`a-${scoreAPulse}`}
          className="transition-transform duration-300 hover:scale-105"
          style={scoreAPulse ? { animation: "score-glow .9s ease-out" } : undefined}
        >
          <ScoreCard
            team="A"
            score={gameState.teamAScore}
            color="border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.35)]"
          />
        </div>

        <div className="flex flex-col items-center">
          <div className="mb-[0.4vh] flex items-center gap-2">
            <span className="h-2 w-2 animate-ping rounded-full bg-yellow-400" />
            <p className="bg-gradient-to-b from-yellow-200 to-amber-500 bg-clip-text text-[clamp(0.6rem,1.6vh,0.9rem)] font-black tracking-[0.45em] text-transparent">
              CHURCH FEUD
            </p>
            <span className="h-2 w-2 animate-ping rounded-full bg-yellow-400" />
          </div>

          <div
            className="relative flex items-center justify-center overflow-hidden rounded-[50%] border-[5px] border-yellow-400 bg-gradient-to-b from-blue-950 via-slate-950 to-blue-950 px-[4vw] py-[0.6vh] shadow-[0_0_50px_rgba(250,204,21,0.45),inset_0_0_25px_rgba(250,204,21,0.3)]"
            style={bankPulse ? { animation: "pop .7s ease-out" } : undefined}
          >
            <div className="shine-layer pointer-events-none absolute inset-0 rounded-[50%]" />
            <div className="pointer-events-none absolute -inset-2 rounded-[50%] border-2 border-dashed border-yellow-300/50" />
            <span className="relative font-mono text-[clamp(2.2rem,7vh,4.5rem)] leading-none font-black tracking-wider text-yellow-400 drop-shadow-[0_0_16px_rgba(250,204,21,0.8)]">
              <AnimatedScore value={gameState.roundBank} />
            </span>
          </div>
          <p className="mt-[0.5vh] rounded-full bg-yellow-400/10 px-4 py-0.5 text-[clamp(0.55rem,1.3vh,0.7rem)] font-black tracking-[0.35em] text-yellow-300">
            ROUND BANK
          </p>
        </div>

        <div
          key={`b-${scoreBPulse}`}
          className="transition-transform duration-300 hover:scale-105"
          style={scoreBPulse ? { animation: "score-glow .9s ease-out" } : undefined}
        >
          <ScoreCard
            team="B"
            score={gameState.teamBScore}
            color="border-red-400 shadow-[0_0_30px_rgba(248,113,113,0.35)]"
          />
        </div>
      </header>

      {/* ------------------------------------------------------------ */}
      {/* Buzzer strip — reserved fixed-height slot, never covers answers */}
      {/* ------------------------------------------------------------ */}
      <div className="relative z-10 mx-auto mt-[1vh] flex h-[10vh] w-full max-w-6xl shrink-0 items-center justify-center">
        {buzzWinner ? (
          <div
            key={`${buzzWinner}-${gameState.buzzerStatus.timestamp}`}
            aria-live="assertive"
            className="relative h-full w-full"
            style={{ animation: "buzz-pop .5s cubic-bezier(0.16,1,0.3,1) both" }}
          >
            {[0, 1].map((r) => (
              <span
                key={r}
                className={`pointer-events-none absolute inset-0 rounded-[1.5rem] border-[5px] ${
                  buzzWinner === "A" ? "border-blue-300" : "border-red-300"
                }`}
                style={{ animation: `buzzer-ring 1.4s ease-out ${r * 0.5}s infinite` }}
              />
            ))}
            <div
              className={`relative flex h-full w-full items-center justify-center gap-[2vw] overflow-hidden rounded-[1.5rem] border-[5px] px-[2vw] ${
                buzzWinner === "A"
                  ? "border-blue-200 bg-gradient-to-r from-blue-900 via-blue-600 to-blue-900 shadow-[0_0_70px_rgba(59,130,246,1)]"
                  : "border-red-200 bg-gradient-to-r from-red-900 via-red-600 to-red-900 shadow-[0_0_70px_rgba(239,68,68,1)]"
              }`}
              style={{ animation: "buzzer-flash .7s infinite" }}
            >
              <div className="shine-layer pointer-events-none absolute inset-0" />
              <span className="relative text-[clamp(1.4rem,6vh,3.5rem)] leading-none">⚡</span>
              <p className="relative whitespace-nowrap text-[clamp(1.8rem,min(6vw,7.5vh),5rem)] leading-none font-black tracking-wide text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.7)]">
                TEAM {buzzWinner} BUZZED IN!
              </p>
              <span className="relative text-[clamp(1.4rem,6vh,3.5rem)] leading-none">⚡</span>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-[1.5rem] border-2 border-dashed border-yellow-400/20 bg-blue-950/30">
            <p className="text-[clamp(0.7rem,2.2vh,1.2rem)] font-black tracking-[0.5em] text-yellow-300/40 uppercase">
              Buzzer Ready
            </p>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------ */}
      {/* Main board — fills remaining height, never grows              */}
      {/* ------------------------------------------------------------ */}
      <section className="relative z-10 mx-auto mt-[1.2vh] flex min-h-0 w-full max-w-6xl flex-1 text-center">
        <div
          className="relative flex h-full w-full flex-col rounded-[2rem] border-[5px] border-amber-500 bg-gradient-to-b from-amber-600 via-yellow-800 to-amber-950 p-[0.9vh] shadow-[0_25px_80px_rgba(0,0,0,0.9),0_0_70px_rgba(245,158,11,0.3)] sm:p-[1.2vh]"
          style={{ animation: "board-in .8s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <div className="marquee-lights pointer-events-none absolute inset-1.5 rounded-[1.6rem] opacity-80" />
          <div className="gold-border pointer-events-none absolute inset-0 rounded-[1.8rem] opacity-30 mix-blend-overlay" />

          {/* Inner TV board */}
          <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.4rem] border-4 border-yellow-300 bg-[radial-gradient(ellipse_at_center,#1e3a8a_0%,#060d26_100%)] p-[1.4vh] shadow-[inset_0_0_60px_rgba(0,0,0,0.95)] sm:p-[1.8vh]">
            <div className="shine-layer pointer-events-none absolute inset-0" />

            {/* Reveal effects */}
            {revealBurst && (
              <div key={revealBurst.id} className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
                <span
                  className="absolute top-1/2 left-1/2 h-48 w-48 rounded-full border-[6px] border-yellow-300"
                  style={{ animation: "flash-ring .9s ease-out forwards" }}
                />
                {Array.from({ length: 16 }, (_, i) => (
                  <span key={i} className="ray" style={{ ["--a" as string]: `${i * 22.5}deg` }} />
                ))}
                {revealBurst.points !== null && (
                  <span
                    className="absolute top-1/2 left-1/2 bg-gradient-to-b from-white via-yellow-200 to-amber-500 bg-clip-text font-mono text-[clamp(3rem,16vh,9rem)] font-black text-transparent drop-shadow-[0_0_24px_rgba(250,204,21,0.95)]"
                    style={{ animation: "points-toast 1.5s ease-out forwards" }}
                  >
                    +{revealBurst.points}
                  </span>
                )}
              </div>
            )}

            {/* Question prompt */}
            <div
              key={`q-${gameState.currentQuestionIndex}`}
              className="relative mx-auto mb-[1.4vh] w-full max-w-4xl shrink-0 rounded-2xl border-2 border-yellow-400/70 bg-gradient-to-b from-blue-900/90 to-slate-950/90 px-[1.5vw] py-[1.2vh] shadow-[0_12px_30px_rgba(0,0,0,0.6),inset_0_2px_15px_rgba(255,255,255,0.15)]"
              style={{ animation: "question-in .6s cubic-bezier(0.16,1,0.3,1) both" }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-4 py-0.5 text-[clamp(0.6rem,1.5vh,0.85rem)] font-black tracking-[0.35em] text-yellow-300">
                <span>QUESTION {gameState.currentQuestionIndex + 1}</span>
                {gameState.multiplier > 1 && (
                  <span
                    className="rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2.5 py-0.5 text-blue-950 shadow"
                    style={{ animation: "pop 1.2s ease-in-out infinite" }}
                  >
                    {gameState.multiplier}X POINTS
                  </span>
                )}
              </div>
              <h1
                className={`mt-[0.6vh] leading-tight font-black tracking-wide text-white uppercase drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)] ${
                  typedPrompt.length < question.prompt.length ? "caret" : ""
                }`}
                style={{ fontSize: "clamp(1.1rem, 3.6vh, 2.6rem)" }}
                aria-label={question.prompt}
              >
                {typedPrompt}
              </h1>
            </div>

            {/* Answer grid — stretches to fill, rows share space equally */}
            <div
              style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
              className="relative mx-auto grid min-h-0 w-full max-w-5xl flex-1 grid-flow-col grid-cols-2 gap-[1.2vh] sm:gap-[1.4vh]"
            >
              {question.answers.map((answer, index) => (
                <div
                  key={`${gameState.currentQuestionIndex}-${answer.text}`}
                  className="answer-cell min-h-0 overflow-hidden"
                  style={{
                    animation: `question-in .55s cubic-bezier(0.16,1,0.3,1) ${0.12 * index + 0.15}s both`,
                  }}
                >
                  <BoardCard
                    answer={answer}
                    index={index}
                    revealed={Boolean(gameState.revealedAnswers[index])}
                  />
                </div>
              ))}
            </div>

            {/* Mini strike lights */}
            <div className="relative mt-[1.2vh] flex shrink-0 items-center justify-center gap-4">
              {[0, 1, 2].map((strikeIndex) => {
                const active = strikeIndex < gameState.strikes;
                return (
                  <div
                    key={`${strikeIndex}-${active}`}
                    className={`flex h-[4.6vh] min-h-7 w-[4.6vh] min-w-7 items-center justify-center rounded-xl border-2 text-[clamp(0.9rem,2.6vh,1.5rem)] font-black transition-all duration-300 ${
                      active
                        ? "scale-110 border-red-300 bg-gradient-to-b from-red-500 to-red-800 text-white shadow-[0_0_28px_rgba(239,68,68,0.95)]"
                        : "border-blue-800/60 bg-blue-950/60 text-blue-900/40"
                    }`}
                    style={active ? { animation: "pop .5s ease-out" } : undefined}
                  >
                    X
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Giant strike overlay                                          */}
      {/* ------------------------------------------------------------ */}
      {strikeFlash !== null && gameState.strikes > 0 && (
        <div
          key={strikeFlash}
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center gap-6 bg-red-950/50 backdrop-blur-[3px]"
          style={{ animation: "strike-bg 1.8s ease-out forwards" }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at center, rgba(239,68,68,.45) 0%, rgba(127,29,29,.0) 65%)",
            }}
          />
          {Array.from({ length: Math.min(gameState.strikes, 3) }, (_, i) => (
            <div
              key={i}
              className="relative flex h-[36vh] w-[36vh] items-center justify-center rounded-3xl border-[8px] border-yellow-400 bg-gradient-to-b from-red-600 via-red-700 to-red-950 shadow-[0_0_100px_rgba(220,38,38,1),inset_0_0_35px_rgba(0,0,0,0.8)]"
              style={{ animation: `strike-slam 1.8s ease-out ${i * 0.12}s forwards`, opacity: 0 }}
            >
              <span className="text-[26vh] leading-none font-black text-white drop-shadow-[0_10px_0_#450a0a]">
                X
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* Winner finale                                                 */}
      {/* ------------------------------------------------------------ */}
      {gameState.gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.96)_0%,rgba(3,6,20,0.99)_100%)] p-6 text-center backdrop-blur-md">
          <div className="sunburst" style={{ opacity: 1 }} />

          <div className="pointer-events-none absolute inset-0">
            {confetti.map((c, i) => (
              <span
                key={i}
                className="confetti-piece"
                style={{
                  left: `${c.left}%`,
                  width: c.size,
                  height: c.size * 0.5,
                  background: c.color,
                  animationDuration: `${c.duration}s`,
                  animationDelay: `${c.delay}s`,
                  ["--spin" as string]: `${c.spin}deg`,
                  ["--drift" as string]: `${c.drift}px`,
                }}
              />
            ))}
          </div>

          <div
            className="relative overflow-hidden rounded-[3rem] border-[6px] border-yellow-400 bg-gradient-to-b from-blue-900/90 to-slate-950/95 px-[5vw] py-[6vh]"
            style={{
              animation:
                "winner-in .8s cubic-bezier(0.16,1,0.3,1) both, winner-glow 2.4s ease-in-out .8s infinite",
            }}
          >
            <div className="shine-layer pointer-events-none absolute inset-0" />
            <p className="relative text-[clamp(0.8rem,2vh,1.2rem)] font-black tracking-[0.6em] text-yellow-300 uppercase">
              🏆 Champion Declared 🏆
            </p>
            <p
              className="relative mt-[2vh] bg-gradient-to-b from-white via-yellow-200 to-amber-500 bg-clip-text text-[clamp(3rem,min(10vw,22vh),9rem)] leading-none font-black text-transparent drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)]"
              style={{ animation: "pop 1.6s ease-in-out .9s infinite" }}
            >
              {winnerLabel}
            </p>
            <div className="relative mt-[4vh] inline-flex flex-wrap items-center justify-center gap-8 rounded-2xl border-2 border-yellow-400/40 bg-blue-950/80 px-10 py-[2vh] text-[clamp(1.2rem,4vh,2.4rem)] font-black text-white shadow-inner">
              <span className="text-blue-300">
                TEAM A: <span className="text-white">{gameState.teamAScore}</span>
              </span>
              <span className="text-yellow-400">•</span>
              <span className="text-red-300">
                TEAM B: <span className="text-white">{gameState.teamBScore}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Connection status */}
      {!connected && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/90 px-4 py-1.5 text-xs font-bold text-amber-300 shadow-lg">
          <span className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
          Firebase connection unavailable
        </div>
      )}
    </main>
  );
}
