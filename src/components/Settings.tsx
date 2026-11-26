"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const FALLBACK_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b", "openai/gpt-oss-20b"];

type Ctx = {
  apiKey: string;
  model: string;
  setModel: (m: string) => void;
  open: () => void;
  headers: () => Record<string, string>;
};

const SettingsCtx = createContext<Ctx | null>(null);
export const useSettings = () => {
  const c = useContext(SettingsCtx);
  if (!c) throw new Error("useSettings outside provider");
  return c;
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModelState] = useState(DEFAULT_MODEL);
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Restore from browser storage on mount (external system → state).
    const k = localStorage.getItem("groqKey") ?? sessionStorage.getItem("groqKey") ?? "";
    const m = localStorage.getItem("groqModel");
    /* eslint-disable react-hooks/set-state-in-effect */
    if (k) setApiKey(k);
    if (m) setModelState(m);
    setRemember(!!localStorage.getItem("groqKey"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const setModel = useCallback((m: string) => {
    setModelState(m);
    localStorage.setItem("groqModel", m);
  }, []);

  const save = (k: string, rem: boolean) => {
    setApiKey(k);
    setRemember(rem);
    localStorage.removeItem("groqKey");
    sessionStorage.removeItem("groqKey");
    if (k) (rem ? localStorage : sessionStorage).setItem("groqKey", k);
  };

  const headers = useCallback(
    (): Record<string, string> => ({
      "Content-Type": "application/json",
      ...(apiKey ? { "x-groq-api-key": apiKey } : {}),
    }),
    [apiKey],
  );

  return (
    <SettingsCtx.Provider value={{ apiKey, model, setModel, open: () => setShow(true), headers }}>
      {children}
      {show && (
        <SettingsModal
          initialKey={apiKey}
          initialRemember={remember}
          model={model}
          onClose={() => setShow(false)}
          onSave={(k, rem, m) => {
            save(k, rem);
            setModel(m);
            setShow(false);
          }}
        />
      )}
    </SettingsCtx.Provider>
  );
}

function SettingsModal(props: {
  initialKey: string;
  initialRemember: boolean;
  model: string;
  onClose: () => void;
  onSave: (key: string, remember: boolean, model: string) => void;
}) {
  const [key, setKey] = useState(props.initialKey);
  const [remember, setRemember] = useState(props.initialRemember);
  const [model, setModel] = useState(props.model);
  const [models, setModels] = useState<string[]>(FALLBACK_MODELS);
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const test = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const r = await fetch("/api/models", { headers: { "x-groq-api-key": key.trim() } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed");
      setModels(j.models);
      if (!j.models.includes(model)) setModel(j.models.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : j.models[0]);
      setStatus({ ok: true, msg: `Key works — ${j.models.length} models available` });
    } catch (e) {
      setStatus({ ok: false, msg: e instanceof Error ? e.message : "Failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={props.onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="border-rainbow animate-pop w-full max-w-lg bg-[#0e0e22] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="settings-title" className="text-xl font-bold">
              🔑 Bring your own Groq key
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Powers the AI assistant and the live agent network. Get a free key at{" "}
              <a className="text-cyan-300 underline" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
                console.groq.com/keys
              </a>
              .
            </p>
          </div>
          <button onClick={props.onClose} className="rounded-lg px-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>

        <label className="mt-5 block text-sm font-medium text-white/80" htmlFor="groq-key">
          Groq API key
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="groq-key"
            type={reveal ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="gsk_…"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-sm outline-none focus:border-violet-400"
          />
          <button onClick={() => setReveal((r) => !r)} className="rounded-xl border border-white/10 px-3 text-sm hover:bg-white/10">
            {reveal ? "Hide" : "Show"}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={test}
            disabled={!key.trim() || testing}
            className="rounded-xl bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/15 disabled:opacity-40"
          >
            {testing ? "Testing…" : "Test key & load models"}
          </button>
          {status && <span className={`text-sm ${status.ok ? "text-emerald-300" : "text-rose-300"}`}>{status.ok ? "✓ " : "✕ "}{status.msg}</span>}
        </div>

        <label className="mt-5 block text-sm font-medium text-white/80" htmlFor="groq-model">
          Model
        </label>
        <select
          id="groq-model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-violet-400"
        >
          {Array.from(new Set([model, ...models])).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <label className="mt-4 flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-violet-500" />
          Remember on this device (otherwise cleared when the tab closes)
        </label>

        <div className="mt-4 rounded-xl bg-emerald-400/10 p-3 text-xs leading-relaxed text-emerald-100/80">
          🔒 Your key stays in your browser and is sent only with your own requests to this app&apos;s server, which forwards it to
          Groq. It is never logged or stored on the server.
        </div>

        <div className="mt-5 flex justify-between gap-2">
          <button
            onClick={() => props.onSave("", false, model)}
            className="rounded-xl px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
          >
            Forget key
          </button>
          <button
            onClick={() => props.onSave(key.trim(), remember, model)}
            className="rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 px-5 py-2 text-sm font-semibold shadow-lg shadow-fuchsia-500/20 hover:brightness-110"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
