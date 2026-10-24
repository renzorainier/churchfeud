import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080d20] px-6 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#1e3a8a_0%,transparent_55%)]" />
      <div className="relative w-full max-w-4xl text-center">
        <p className="mb-4 text-sm font-bold tracking-[0.4em] text-yellow-300">WELCOME TO</p>
        <h1 className="text-6xl font-black tracking-tight sm:text-8xl">CHURCH FEUD</h1>
        <p className="mx-auto mt-5 max-w-xl text-slate-400">A real-time game show control room. Open a screen below to get started.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link className="rounded-xl border border-yellow-400/50 bg-yellow-400 px-5 py-4 font-black text-blue-950 transition hover:-translate-y-1 hover:bg-yellow-300" href="/display">STAGE DISPLAY</Link>
          <Link className="rounded-xl border border-blue-400/50 bg-blue-700 px-5 py-4 font-black transition hover:-translate-y-1 hover:bg-blue-600" href="/admin">ADMIN BOOTH</Link>
        </div>
        <div className="mt-10">
          <p className="text-xs font-black tracking-[0.35em] text-slate-500">PLAYER CONTROLS</p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Link className="group rounded-2xl border-2 border-blue-300/60 bg-blue-950/70 p-5 shadow-2xl transition hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-900" href="/buzzer?team=A">
              <span className="block text-sm font-black tracking-[0.3em] text-blue-200">TEAM PASTOR CHRIST</span>
              <span className="mt-3 block rounded-full border-4 border-blue-300 bg-blue-600 py-5 text-2xl font-black shadow-[inset_0_-8px_0_rgba(0,0,0,.25),0_8px_0_#172554] transition group-hover:bg-blue-500 group-active:translate-y-1 group-active:shadow-[inset_0_-4px_0_rgba(0,0,0,.25),0_4px_0_#172554]">BUZZER</span>
            </Link>
            <Link className="group rounded-2xl border-2 border-red-300/60 bg-red-950/70 p-5 shadow-2xl transition hover:-translate-y-1 hover:border-red-200 hover:bg-red-900" href="/buzzer?team=B">
              <span className="block text-sm font-black tracking-[0.3em] text-red-200">TEAM MAAM IVY</span>
              <span className="mt-3 block rounded-full border-4 border-red-300 bg-red-600 py-5 text-2xl font-black shadow-[inset_0_-8px_0_rgba(0,0,0,.25),0_8px_0_#450a0a] transition group-hover:bg-red-500 group-active:translate-y-1 group-active:shadow-[inset_0_-4px_0_rgba(0,0,0,.25),0_4px_0_#450a0a]">BUZZER</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
