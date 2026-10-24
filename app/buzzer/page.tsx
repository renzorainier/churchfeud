"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { claimBuzzer } from "@/lib/firebase-rest";
import { useGameState } from "@/hooks/useGameState";
import { teamName } from "@/lib/game";
import type { Team } from "@/lib/types";

export default function BuzzerPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-900" />}><Buzzer /></Suspense>;
}

function Buzzer() {
  const params = useSearchParams();
  const team = params.get("team") === "B" || params.toString().toUpperCase().includes("TEAM%3DB") ? "B" : "A";
  const { gameState } = useGameState();
  const [error, setError] = useState("");
  const buzzer = gameState.buzzerStatus;
  const won = buzzer.winner === team;

  async function buzz() {
    if (buzzer.locked) return;
    setError("");
    try {
      await claimBuzzer(team as Team);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to connect to buzzer.");
    }
  }

  const locked = buzzer.locked;
  const teamIsBlue = team === "A";
  const displayTeamName = teamName(team);
  return (
    <main className={`flex min-h-screen items-center justify-center overflow-hidden p-6 transition-colors ${!locked ? teamIsBlue ? "bg-blue-950" : "bg-red-950" : won ? "bg-emerald-950" : "bg-slate-950"}`}>
      <button
        disabled={locked}
        onClick={buzz}
        aria-label={`Team ${displayTeamName} buzzer`}
        className={`group flex min-h-[85vh] w-full max-w-2xl flex-col items-center justify-center rounded-[3rem] border-4 p-8 text-center shadow-2xl transition ${
          !locked ? teamIsBlue ? "border-blue-400/40 bg-blue-900/40" : "border-red-400/40 bg-red-900/40" : won ? "border-emerald-300/50 bg-emerald-900/40" : "border-slate-700 bg-slate-900"
        }`}
      >
        <span className="text-xl font-black tracking-[0.22em] text-white/70">TEAM {displayTeamName.toUpperCase()}</span>
        <span className={`mt-10 flex aspect-square w-[min(70vw,22rem)] items-center justify-center rounded-full border-[14px] text-4xl font-black shadow-[inset_0_-18px_0_rgba(0,0,0,.3),0_18px_0_rgba(0,0,0,.45),0_0_60px_rgba(255,255,255,.16)] transition sm:text-5xl ${
          !locked ? teamIsBlue ? "border-blue-200 bg-blue-600 group-hover:bg-blue-500 group-active:translate-y-3 group-active:shadow-[inset_0_-8px_0_rgba(0,0,0,.3),0_6px_0_rgba(0,0,0,.45)]" : "border-red-200 bg-red-600 group-hover:bg-red-500 group-active:translate-y-3 group-active:shadow-[inset_0_-8px_0_rgba(0,0,0,.3),0_6px_0_rgba(0,0,0,.45)]" : won ? "border-emerald-200 bg-emerald-500" : "border-slate-600 bg-slate-700"
        }`}>
          {!locked ? "BUZZ" : won ? "YOU BUZZED IN!" : "LOCKED OUT"}
        </span>
        {error && <span className="mt-8 max-w-sm text-sm text-red-200">{error}</span>}
        {!locked && <span className="mt-10 rounded-full border-2 border-white/30 px-6 py-3 text-sm font-bold tracking-[0.25em] text-white/80">PRESS THE BUTTON</span>}
      </button>
    </main>
  );
}
