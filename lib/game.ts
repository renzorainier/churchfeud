import type { GameState, SfxTrigger } from "@/lib/types";

export const emptyRevealedAnswers = (count = 6): Record<string, boolean> =>
  Object.fromEntries(Array.from({ length: count }, (_, index) => [index, false]));

export const initialGameState: GameState = {
  currentQuestionIndex: 0,
  teamAScore: 0,
  teamBScore: 0,
  roundBank: 0,
  multiplier: 1,
  strikes: 0,
  musicVolume: 20,
  buzzerStatus: { locked: false, winner: null, timestamp: 0 },
  revealedAnswers: emptyRevealedAnswers(),
  gameOver: false,
  winner: null,
};

export const initialSfxTrigger: SfxTrigger = { sound: "none", timestamp: 0 };
