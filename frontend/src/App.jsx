
import { useState } from "react";

const actions = [
  { id: "explain", label: "Explain code", icon: "📖" },
  { id: "debug", label: "Find bugs", icon: "🐛" },
  { id: "optimize", label: "Optimize", icon: "⚡" },
  { id: "tests", label: "Generate tests", icon: "🧪" },
];

export default function App() {
  const [language, setLanguage] = useState("javascript");
  const [action, setAction] = useState("explain");
  const [code, setCode] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function analyzeCode() {
    if (!code.trim()) {
      setError("Paste some code before starting an analysis.");
      setResult("");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          language,
          action,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Analysis failed.");
      }

      if (typeof data.result !== "string" || !data.result.trim()) {
        throw new Error("The analysis returned an empty response. Please try again.");
      }
      setResult(data.result);
    } catch (error) {
      setError(error instanceof TypeError
        ? "Could not reach CodeWise. Check that the backend is running, then try again."
        : error.message || "Analysis failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }


  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Code<span className="text-cyan-400">Wise</span>
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Your AI coding companion
          </p>
        </div>

        <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
          V1 · Code Assistant
        </span>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-8">
          <h2 className="text-3xl font-semibold tracking-tight">
            Understand your code.
            <span className="text-cyan-400"> Build better.</span>
          </h2>
          <p className="mt-3 text-sm text-zinc-400">
            Paste your code, choose an action, and let CodeWise help.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 p-4">
              <h3 className="text-sm font-medium">Your code</h3>

              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>

            <textarea
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={"// Paste your code here...\n\nfunction add(a, b) {\n  return a + b;\n}"}
              spellCheck={false}
              className="min-h-80 w-full resize-y bg-transparent p-5 font-mono text-sm leading-7 text-zinc-200 outline-none placeholder:text-zinc-600"
              aria-label="Code to analyze"
              disabled={isLoading}
            />

            <div className="border-t border-zinc-800 p-4">
              <p className="mb-3 text-xs text-zinc-500">Choose an action</p>

              <div className="grid grid-cols-2 gap-2">
                {actions.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setAction(item.id)}
                    disabled={isLoading}
                    aria-pressed={action === item.id}
                    className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                      action === item.id
                        ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                        : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setCode("")} disabled={!code || isLoading}
                  className="rounded-lg border border-zinc-700 px-4 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40">
                  Clear
                </button>
                <button type="button" onClick={analyzeCode} disabled={isLoading}
                  className="flex-1 rounded-lg bg-cyan-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60">
                  {isLoading ? "Analyzing…" : "Analyze code"}
                </button>
              </div>
            </div>
          </section>

          <section className="min-h-80 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="border-b border-zinc-800 pb-4">
              <h3 className="font-medium">CodeWise response</h3>
              <p className="mt-1 text-xs text-zinc-500" aria-live="polite">
                {isLoading ? "Working on your request…" : "Your results will appear here."}
              </p>
            </div>

            <div className="py-6">
              {error ? (
                <p role="alert" className="rounded-lg border border-rose-900/70 bg-rose-950/30 p-4 text-sm leading-6 text-rose-300">
                  {error}
                </p>
              ) : result ? (
                <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                  {result}
                </p>
              ) : (
                <div className="flex min-h-48 flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 text-xl">
                    ✨
                  </div>
                  <p className="text-sm text-zinc-300">
                    Ready to analyze your code
                  </p>
                  <p className="mt-2 max-w-xs text-xs leading-6 text-zinc-500">
                    Your explanations, bug reports, and test suggestions will
                    appear in this panel.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          CodeWise can suggest issues, but generated code should always be tested.
        </p>
      </main>
    </div>
  );
}
