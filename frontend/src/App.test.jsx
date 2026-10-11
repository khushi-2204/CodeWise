// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

const { clerkAuth } = vi.hoisted(() => ({
  clerkAuth: { isLoaded: true, isSignedIn: true, getToken: vi.fn() },
}));

vi.mock("@clerk/react", () => ({
  useAuth: () => clerkAuth,
  SignIn: () => "Sign-in form",
  SignUp: () => "Sign-up form",
  UserButton: () => "Account menu",
}));

beforeEach(() => {
  clerkAuth.isLoaded = true;
  clerkAuth.isSignedIn = true;
  clerkAuth.getToken.mockReset().mockResolvedValue("test-session-token");
  window.location.hash = "";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CodeWise analysis flow", () => {
  it("sends the selected action and shows a loading state while waiting", async () => {
    let finishRequest;
    const fetchMock = vi.fn(() => new Promise((resolve) => { finishRequest = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(screen.getByRole("textbox", { name: "Code to analyze" }), {
      target: { value: "function add(a, b) { return a + b; }" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Find bugs/ }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze code" }));

    expect(screen.getByRole("button", { name: "Analyzing…" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /Find bugs/ }).disabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/analyze", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        code: "function add(a, b) { return a + b; }",
        language: "javascript",
        action: "debug",
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-session-token",
      },
    }));

    finishRequest({
      ok: true,
      json: async () => ({ result: "## No bugs found\nThe function returns the sum." }),
    });

    expect(await screen.findByRole("heading", { name: "No bugs found" })).toBeTruthy();
    expect(screen.getByText("The function returns the sum.")).toBeTruthy();
  });

  it("renders fenced code as code and keeps HTML-looking model output inert", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: "## Example\n```javascript\nconsole.log('safe');\n```\n<img src=x onerror=alert(1)>",
      }),
    }));
    render(<App />);

    fireEvent.change(screen.getByRole("textbox", { name: "Code to analyze" }), {
      target: { value: "console.log('safe');" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze code" }));

    expect(await screen.findByRole("heading", { name: "Example" })).toBeTruthy();
    expect(document.querySelector("pre code").textContent).toBe("console.log('safe');");
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
  });

  it("shows a readable API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "The AI provider is rate-limiting requests." }),
    }));
    render(<App />);

    fireEvent.change(screen.getByRole("textbox", { name: "Code to analyze" }), {
      target: { value: "const answer = 42;" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze code" }));

    expect((await screen.findByRole("alert")).textContent).toContain("rate-limiting");
  });

  it("shows sign-in and sign-up choices before the analyzer for signed-out users", () => {
    clerkAuth.isSignedIn = false;
    render(<App />);

    expect(screen.getByText("Sign-in form")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(screen.getByText("Sign-up form")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Code to analyze" })).toBeNull();
  });
});
