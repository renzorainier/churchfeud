"use client";

import { useState } from "react";
import { questions } from "@/data/questions";
import { emptyRevealedAnswers } from "@/lib/game";
import { isFirebaseConfigured } from "@/lib/firebase";
import { patchFirebase } from "@/lib/firebase-rest";
import { useGameState } from "@/hooks/useGameState";
import { teamNames } from "@/lib/game";

const timestamp = () => Date.now();

export default function AdminPage() {
  const { gameState, connected, connectionError } = useGameState();
  const question = questions[gameState.currentQuestionIndex] ?? questions[0];
  const [message, setMessage] = useState("");

  async function change(values: Record<string, unknown>) {
    try {
      await patchFirebase(values);
      setMessage("Updated.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Update failed.");
    }
  }

  function reveal(index: number, points: number) {
    if (gameState.gameOver || gameState.revealedAnswers[index]) return;
    void change({
      [`gameState/revealedAnswers/${index}`]: true,
      "gameState/roundBank": gameState.roundBank + points * gameState.multiplier,
      "sfxTrigger": { sound: "ding", timestamp: timestamp() },
    });
  }

  function strike() {
    if (gameState.gameOver) return;
    void change({ "gameState/strikes": Math.min(gameState.strikes + 1, 3), "sfxTrigger": { sound: "strike", timestamp: timestamp() } });
  }

  function nextQuestion() {
    if (gameState.gameOver) return;
    const next = Math.min(gameState.currentQuestionIndex + 1, questions.length - 1);
    if (next === gameState.currentQuestionIndex) {
      setMessage("This is the final question. Award the bank, then end the game.");
      return;
    }
    void change({
      "gameState/currentQuestionIndex": next,
      "gameState/multiplier": questions[next].multiplier,
      "gameState/strikes": 0,
      "gameState/roundBank": 0,
      "gameState/revealedAnswers": emptyRevealedAnswers(questions[next].answers.length),
      "gameState/buzzerStatus": { locked: false, winner: null, timestamp: 0 },
    });
  }

  function endGame() {
    if (gameState.roundBank > 0) {
      setMessage("Award the round bank before ending the game.");
      return;
    }
    const winner = gameState.teamAScore === gameState.teamBScore ? "tie" : gameState.teamAScore > gameState.teamBScore ? "A" : "B";
    void change({ "gameState/gameOver": true, "gameState/winner": winner });
  }

  function newGame() {
    void change({
      gameState: {
        currentQuestionIndex: 0,
        teamAScore: 0,
        teamBScore: 0,
        roundBank: 0,
        multiplier: questions[0].multiplier,
        strikes: 0,
        musicVolume: gameState.musicVolume,
        buzzerStatus: { locked: false, winner: null, timestamp: 0 },
        revealedAnswers: emptyRevealedAnswers(questions[0].answers.length),
        gameOver: false,
        winner: null,
      },
    });
  }

  return (
    <main className="min-h-screen bg-[#080d20] px-5 py-6 text-white sm:px-10">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div><p className="text-xs font-bold tracking-[0.3em] text-yellow-300">CONTROL ROOM</p><h1 className="text-3xl font-black">CHURCH FEUD</h1></div>
        <div className="flex gap-3 text-center"><div className="rounded border border-yellow-400/40 px-5 py-2"><span className="block text-xs text-slate-400">BANK</span><strong className="text-2xl text-yellow-300">{gameState.roundBank}</strong></div><div className="rounded border border-blue-400/40 px-5 py-2"><span className="block text-xs text-slate-400">{teamNames.A.toUpperCase()}</span><strong className="text-2xl">{gameState.teamAScore}</strong></div><div className="rounded border border-red-400/40 px-5 py-2"><span className="block text-xs text-slate-400">{teamNames.B.toUpperCase()}</span><strong className="text-2xl">{gameState.teamBScore}</strong></div></div>
      </header>
      <section className="mx-auto mt-8 max-w-6xl">
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5"><p className="text-xs font-bold tracking-[0.25em] text-yellow-300">QUESTION {gameState.currentQuestionIndex + 1} · {gameState.multiplier}X ROUND</p><h2 className="mt-2 text-2xl font-black">{question.prompt}</h2></div>
        <div className="mt-5 rounded-xl border border-white/10 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="music-volume" className="font-black">BACKGROUND MUSIC</label>
            <output htmlFor="music-volume" className="font-black text-yellow-300">{gameState.musicVolume}%</output>
          </div>
          <input
            id="music-volume"
            type="range"
            min="0"
            max="100"
            step="1"
            value={gameState.musicVolume}
            onChange={(event) => void change({ "gameState/musicVolume": Number(event.target.value) })}
            className="mt-4 w-full accent-yellow-400"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-500"><span>Muted</span><span>Full volume</span></div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {question.answers.map((answer, index) => <div key={answer.text} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900 px-4 py-3"><span><b className="mr-3 text-yellow-300">{index + 1}</b>{answer.text} <small className="ml-2 text-slate-500">{answer.points} pts</small></span>          <button disabled={gameState.gameOver || Boolean(gameState.revealedAnswers[index])} onClick={() => reveal(index, answer.points)} className="rounded bg-yellow-400 px-4 py-2 text-sm font-black text-blue-950 disabled:cursor-not-allowed disabled:opacity-30">{gameState.revealedAnswers[index] ? "REVEALED" : "REVEAL"}</button></div>)}
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button onClick={strike} className="rounded-lg bg-red-700 px-4 py-4 font-black hover:bg-red-600">STRIKE (X)</button>
          <button onClick={() => void change({ "gameState/strikes": 0 })} className="rounded-lg bg-slate-700 px-4 py-4 font-black hover:bg-slate-600">CLEAR STRIKES</button>
          <button onClick={() => void change({ "gameState/buzzerStatus": { locked: false, winner: null, timestamp: 0 } })} className="rounded-lg bg-slate-700 px-4 py-4 font-black hover:bg-slate-600">RESET BUZZERS</button>
          <button onClick={nextQuestion} disabled={gameState.gameOver} className="rounded-lg bg-blue-700 px-4 py-4 font-black hover:bg-blue-600 disabled:opacity-40">NEXT QUESTION</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3"><button onClick={() => void change({ "gameState/teamAScore": gameState.teamAScore + gameState.roundBank, "gameState/roundBank": 0 })} className="rounded-lg border-2 border-blue-400 bg-blue-950 px-4 py-4 font-black">AWARD {teamNames.A.toUpperCase()}</button><button onClick={() => void change({ "gameState/teamBScore": gameState.teamBScore + gameState.roundBank, "gameState/roundBank": 0 })} className="rounded-lg border-2 border-red-400 bg-red-950 px-4 py-4 font-black">AWARD {teamNames.B.toUpperCase()}</button></div>
        <div className="mt-3 grid grid-cols-2 gap-3"><button onClick={endGame} disabled={gameState.gameOver} className="rounded-lg bg-yellow-400 px-4 py-4 font-black text-blue-950 disabled:opacity-40">END GAME</button><button onClick={newGame} className="rounded-lg bg-white px-4 py-4 font-black text-slate-950">NEW GAME</button></div>
        <p className={`mt-5 text-sm ${isFirebaseConfigured && connected ? "text-emerald-300" : "text-amber-300"}`}>
          {message || (connectionError ? `Firebase error: ${connectionError}` : isFirebaseConfigured && connected ? "Firebase live and connected." : isFirebaseConfigured ? "Connecting to Firebase..." : "Demo mode: configure Firebase to send live updates.")}
        </p>
      </section>
    </main>
  );
}
