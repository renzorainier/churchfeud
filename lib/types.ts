export type Team = "A" | "B";
export type Sound = "none" | "ding" | "strike" | "buzzer";

export type GameState = {
  currentQuestionIndex: number;
  teamAScore: number;
  teamBScore: number;
  roundBank: number;
  multiplier: number;
  strikes: number;
  musicVolume: number;
  buzzerStatus: {
    locked: boolean;
    winner: Team | null;
    timestamp: number;
  };
  revealedAnswers: Record<string, boolean>;
  gameOver: boolean;
  winner: Team | "tie" | null;
};

export type SfxTrigger = { sound: Sound; timestamp: number };
