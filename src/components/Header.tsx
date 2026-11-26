"use client";

import Link from "next/link";
import { useSettings } from "./Settings";

const LINKS = [
  ["/#learn", "Learn"],
  ["/#usecase", "Smart-factory demo"],
  ["/#assistant", "AI assistant"],
  ["/healthcare", "🏥 Healthcare assignment"],
];

export function Header() {
  const { apiKey, model, open } = useSettings();
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#070714]/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-sm">🌐</span>
          <span className="hidden sm:inline">
            Beyond <span className="text-rainbow">MCP</span>
          </span>
        </Link>
        <nav className="hidden gap-1 md:flex">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-lg px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
        <button
          onClick={open}
          className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
            apiKey ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-amber-400/50 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${apiKey ? "bg-emerald-400" : "bg-amber-400"}`} />
          {apiKey ? <span className="max-w-40 truncate">Groq · {model}</span> : "⚙️ Add Groq key"}
        </button>
      </div>
    </header>
  );
}
