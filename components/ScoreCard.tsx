export function ScoreCard({ team, score, color }: { team: string; score: number; color: string }) {
  return (
    <div className={`min-w-28 rounded-xl border-4 ${color} bg-blue-950/90 p-3 text-center shadow-[inset_0_0_14px_rgba(0,0,0,.6),0_5px_0_rgba(0,0,0,.35)]`}>
      <p className="text-xs font-black tracking-[0.18em] text-yellow-200">TEAM {team}</p>
      <p className="mt-1 text-4xl font-black text-white sm:text-5xl">{score}</p>
    </div>
  );
}
