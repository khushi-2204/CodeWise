
import { useCallback, useEffect, useState } from "react";
import AuthPage from "./AuthPage";

function renderInline(text, keyPrefix) {
  const pieces = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);

  return pieces.map((piece, index) => {
    const key = `${keyPrefix}-${index}`;
    if (piece.startsWith("**") && piece.endsWith("**")) {
      return <strong key={key}>{piece.slice(2, -2)}</strong>;
    }
    if (piece.startsWith("`") && piece.endsWith("`")) {
      return <code key={key} className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-cyan-200">{piece.slice(1, -1)}</code>;
    }
    if (piece.startsWith("*") && piece.endsWith("*")) {
      return <em key={key}>{piece.slice(1, -1)}</em>;
    }
    return piece;
  });
}

function renderMarkdown(markdown) {
  const lines = markdown.split("\n");
  const blocks = [];
  let paragraph = [];
  let list = [];
  let codeLines = null;
  let codeLanguage = "";

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(paragraph.join(" "), `p-${blocks.length}`)}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {list.map((item, index) => <li key={`li-${index}`}>{renderInline(item, `li-${blocks.length}-${index}`)}</li>)}
      </ul>,
    );
    list = [];
  };

  lines.forEach((line) => {
    if (codeLines) {
      if (line.startsWith("```")) {
        flushParagraph();
        flushList();
        blocks.push(
          <pre key={`code-${blocks.length}`} className="overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-950 p-4 text-xs leading-6">
            {codeLanguage && <span className="mb-2 block font-sans text-[10px] uppercase tracking-wider text-zinc-500">{codeLanguage}</span>}
            <code>{codeLines.join("\n")}</code>
          </pre>,
        );
        codeLines = null;
        codeLanguage = "";
      } else {
        codeLines.push(line);
      }
      return;
    }

    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      codeLines = [];
      codeLanguage = line.slice(3).trim();
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph();
      list.push(line.replace(/^\s*[-*+]\s+/, ""));
    } else {
      flushList();
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        const Heading = `h${heading[1].length}`;
        blocks.push(<Heading key={`h-${blocks.length}`} className="font-semibold text-zinc-100">{renderInline(heading[2], `h-${blocks.length}`)}</Heading>);
      } else {
        paragraph.push(line);
      }
    }
  });

  flushParagraph();
  flushList();
  if (codeLines) {
    blocks.push(<pre key={`code-${blocks.length}`} className="overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-950 p-4 text-xs leading-6"><code>{codeLines.join("\n")}</code></pre>);
  }

  return blocks;
}

const actions = [
  { id: "explain", label: "Explain code", icon: "📖" },
  { id: "debug", label: "Find bugs", icon: "🐛" },
  { id: "optimize", label: "Optimize", icon: "⚡" },
  { id: "tests", label: "Generate tests", icon: "🧪" },
];

function AnalysisWorkspace({ user, onLogout, csrfToken, authError, authLoading }) {
  const [language, setLanguage] = useState("javascript");
  const [action, setAction] = useState("explain");
  const [code, setCode] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(result);
      setCopyMessage("Copied");
    } catch {
      setCopyMessage("Could not copy. Check clipboard permissions.");
    }
    window.setTimeout(() => setCopyMessage(""), 2000);
  }

  async function analyzeCode() {
    if (!code.trim()) {
      setError("Paste some code before starting an analysis.");
      setResult("");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult("");

    const requestController = new AbortController();
    const requestTimeout = window.setTimeout(() => requestController.abort(), 50_000);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          code,
          language,
          action,
        }),
        signal: requestController.signal,
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
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        setError("This request took too long. Please try again.");
      } else {
        setError(error instanceof TypeError
          ? "Could not reach CodeWise. Check that the backend is running, then try again."
          : error.message || "Analysis failed. Please try again.");
      }
    } finally {
      window.clearTimeout(requestTimeout);
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
        <div className="flex items-center gap-3">
          <span className="hidden max-w-48 truncate text-xs text-zinc-500 sm:block">{user.name}</span>
          <button type="button" onClick={onLogout} disabled={authLoading}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-500 disabled:opacity-50">
            {authLoading ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        {authError && <p role="alert" className="mb-5 rounded-lg border border-rose-900/70 bg-rose-950/30 p-4 text-sm text-rose-300">{authError}</p>}
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
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">CodeWise response</h3>
                <div className="flex items-center gap-2">
                  {copyMessage && <span role="status" className="text-xs text-zinc-400">{copyMessage}</span>}
                  <button type="button" onClick={copyResult} disabled={!result || isLoading}
                    className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40">
                    Copy result
                  </button>
                </div>
              </div>
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
                <div className="space-y-4 text-sm leading-7 text-zinc-300 [&_h1]:text-lg [&_h2]:text-base [&_p]:whitespace-pre-wrap">
                  {renderMarkdown(result)}
                </div>
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

export default function App() {
  const [user, setUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const loadAuthState = useCallback(async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include" });
      const csrfData = await csrfResponse.json().catch(() => ({}));
      if (!csrfResponse.ok || !csrfData.csrfToken) throw new Error(csrfData.message || "Could not start a secure session.");
      setCsrfToken(csrfData.csrfToken);

      const response = await fetch("/api/auth/me", { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) setUser(null);
      else if (!response.ok) throw new Error(data.message || "Could not restore your sign-in session.");
      else setUser(data.user);
    } catch (error) {
      setAuthError(error instanceof TypeError
        ? "Could not reach CodeWise. Check that the backend is running, then retry."
        : error.message || "Could not restore your sign-in session.");
    } finally {
      setAuthReady(true);
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) loadAuthState(); });
    return () => { active = false; };
  }, [loadAuthState]);

  async function submitAuth({ name, email, password }) {
    setAuthLoading(true);
    setAuthError("");
    try {
      const endpoint = authMode === "signup" ? "signup" : "login";
      const response = await fetch(`/api/auth/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not sign in. Please try again.");
      setUser(data.user);
      setCsrfToken(data.csrfToken);
    } catch (error) {
      setAuthError(error instanceof TypeError
        ? "Could not reach CodeWise. Check that the backend is running, then try again."
        : error.message || "Could not sign in. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    setAuthLoading(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": csrfToken },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not sign out. Please try again.");
      setUser(null);
      setAuthMode("login");
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include" });
      const csrfData = await csrfResponse.json().catch(() => ({}));
      if (csrfResponse.ok) setCsrfToken(csrfData.csrfToken || "");
    } catch (error) {
      setAuthError(error.message || "Could not sign out. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  if (!authReady) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">Loading CodeWise…</div>;
  }

  if (!user) {
    return <AuthPage mode={authMode} onModeChange={(mode) => { setAuthMode(mode); setAuthError(""); }}
      onSubmit={submitAuth} onRetry={loadAuthState} error={authError} isLoading={authLoading} />;
  }

  return <AnalysisWorkspace user={user} onLogout={logout} csrfToken={csrfToken} authError={authError} authLoading={authLoading} />;
}
