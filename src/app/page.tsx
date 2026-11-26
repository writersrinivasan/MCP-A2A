import { Assistant } from "@/components/Assistant";
import { FactoryUseCase } from "@/components/FactoryUseCase";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Modules } from "@/components/Modules";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Modules />
        <FactoryUseCase />
        <Assistant />
      </main>
      <footer className="border-t border-white/5 py-8 text-center text-sm text-white/40">
        Built with Next.js · LangGraph · Groq (BYOK). The A2A envelopes shown are illustrative of the protocol, and the factory data is simulated.
      </footer>
    </>
  );
}
