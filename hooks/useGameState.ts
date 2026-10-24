"use client";

import { useEffect, useState } from "react";
import { firebaseDatabaseUrl, isFirebaseConfigured } from "@/lib/firebase";
import { initialGameState, initialSfxTrigger } from "@/lib/game";
import type { GameState, SfxTrigger } from "@/lib/types";

export function useGameState() {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [sfxTrigger, setSfxTrigger] = useState<SfxTrigger>(initialSfxTrigger);
  const [connected, setConnected] = useState(isFirebaseConfigured);
  const [connectionError, setConnectionError] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseDatabaseUrl) return;
    let active = true;
    const readState = async () => {
      try {
        const [stateResponse, sfxResponse] = await Promise.all([
          fetch(`${firebaseDatabaseUrl}/gameState.json`),
          fetch(`${firebaseDatabaseUrl}/sfxTrigger.json`),
        ]);
        if (!stateResponse.ok || !sfxResponse.ok) throw new Error(`Firebase returned ${stateResponse.status}/${sfxResponse.status}.`);
        const state = await stateResponse.json();
        const sfx = await sfxResponse.json();
        if (!active) return;
        setConnected(true);
        setConnectionError("");
        if (state) setGameState({ ...initialGameState, ...state, buzzerStatus: { ...initialGameState.buzzerStatus, ...state.buzzerStatus } });
        if (sfx) setSfxTrigger({ ...initialSfxTrigger, ...sfx });
      } catch (error) {
        if (active) {
          setConnected(false);
          setConnectionError(error instanceof Error ? error.message : "Unable to reach Firebase.");
        }
      }
    };
    void readState();
    const interval = window.setInterval(readState, 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return { gameState, sfxTrigger, connected, connectionError };
}
