import { useState } from "react";

export default function AuthPage({ mode, onModeChange, onSubmit, onRetry, error, isLoading }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isSignup = mode === "signup";

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({ name, email, password });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-5 py-10 text-zinc-100">
      <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-7 shadow-2xl shadow-black/30 sm:p-9">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            Code<span className="text-cyan-400">Wise</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-400">Your AI coding companion</p>
        </header>

        <div className="mb-6 grid grid-cols-2 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
          <button type="button" onClick={() => onModeChange("login")} aria-pressed={!isSignup}
            className={`rounded-md px-3 py-2 text-sm transition ${!isSignup ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
            Sign in
          </button>
          <button type="button" onClick={() => onModeChange("signup")} aria-pressed={isSignup}
            className={`rounded-md px-3 py-2 text-sm transition ${isSignup ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
            Create account
          </button>
        </div>

        <h2 className="text-xl font-semibold">{isSignup ? "Create your account" : "Welcome back"}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {isSignup ? "Sign up to start analyzing code." : "Sign in to continue to your workspace."}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {isSignup && (
            <label className="block text-sm text-zinc-300">
              Name
              <input autoComplete="name" required minLength={1} maxLength={80} value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none transition focus:border-cyan-500" />
            </label>
          )}
          <label className="block text-sm text-zinc-300">
            Email address
            <input type="email" autoComplete="email" required maxLength={254} value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none transition focus:border-cyan-500" />
          </label>
          <label className="block text-sm text-zinc-300">
            Password
            <input type="password" autoComplete={isSignup ? "new-password" : "current-password"} required
              minLength={12} maxLength={72} value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby="password-hint"
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none transition focus:border-cyan-500" />
            <span id="password-hint" className="mt-1 block text-xs text-zinc-500">Use at least 12 characters.</span>
          </label>

          {error && <p role="alert" className="rounded-lg border border-rose-900/70 bg-rose-950/30 p-3 text-sm text-rose-300">{error}</p>}

          <button type="submit" disabled={isLoading}
            className="w-full rounded-lg bg-cyan-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60">
            {isLoading ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
          </button>
          {error && onRetry && <button type="button" onClick={onRetry} disabled={isLoading} className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300">Retry connection</button>}
        </form>
      </section>
    </main>
  );
}
