// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

const user = { id: "user-1", name: "CodeWise Dev", email: "dev@example.com" };
const csrfToken = "csrf-test-token";

function signedInFetch(analyzeResponse) {
  return vi.fn((url) => {
    if (url === "/api/auth/csrf") return Promise.resolve({ ok: true, json: async () => ({ csrfToken }) });
    if (url === "/api/auth/me") return Promise.resolve({ ok: true, status: 200, json: async () => ({ user }) });
    if (url === "/api/analyze") return Promise.resolve(analyzeResponse);
    return Promise.resolve({ ok: false, status: 404, json: async () => ({ message: "Unexpected request" }) });
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CodeWise analysis flow", () => {
  it("sends the selected action and shows a loading state while waiting", async () => {
    let finishRequest;
    const fetchMock = vi.fn((url) => {
      if (url === "/api/auth/csrf") return Promise.resolve({ ok: true, json: async () => ({ csrfToken }) });
      if (url === "/api/auth/me") return Promise.resolve({ ok: true, status: 200, json: async () => ({ user }) });
      if (url === "/api/analyze") return new Promise((resolve) => { finishRequest = resolve; });
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(await screen.findByRole("textbox", { name: "Code to analyze" }), {
      target: { value: "function add(a, b) { return a + b; }" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Find bugs/ }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze code" }));

    expect(screen.getByRole("button", { name: "Analyzing…" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /Find bugs/ }).disabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/analyze", expect.objectContaining({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({
        code: "function add(a, b) { return a + b; }",
        language: "javascript",
        action: "debug",
      }),
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
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
    vi.stubGlobal("fetch", signedInFetch({
      ok: true,
      json: async () => ({ result: "## Example\n```javascript\nconsole.log('safe');\n```\n<img src=x onerror=alert(1)>" }),
    }));
    render(<App />);

    fireEvent.change(await screen.findByRole("textbox", { name: "Code to analyze" }), {
      target: { value: "console.log('safe');" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze code" }));

    expect(await screen.findByRole("heading", { name: "Example" })).toBeTruthy();
    expect(document.querySelector("pre code").textContent).toBe("console.log('safe');");
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
  });

  it("shows a readable API error", async () => {
    vi.stubGlobal("fetch", signedInFetch({
      ok: false,
      json: async () => ({ message: "The AI provider is rate-limiting requests." }),
    }));
    render(<App />);

    fireEvent.change(await screen.findByRole("textbox", { name: "Code to analyze" }), {
      target: { value: "const answer = 42;" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze code" }));

    expect((await screen.findByRole("alert")).textContent).toContain("rate-limiting");
  });

  it("creates an account and only displays analysis after signup succeeds", async () => {
    const fetchMock = vi.fn((url) => {
      if (url === "/api/auth/csrf") return Promise.resolve({ ok: true, json: async () => ({ csrfToken }) });
      if (url === "/api/auth/me") return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
      if (url === "/api/auth/signup") return Promise.resolve({ ok: true, status: 201, json: async () => ({ user, csrfToken: "rotated-token" }) });
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Create account" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: user.name } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: user.email } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "a-strong-password-12" } });
    const accountButtons = screen.getAllByRole("button", { name: "Create account", exact: true });
    fireEvent.click(accountButtons[accountButtons.length - 1]);

    expect(await screen.findByRole("textbox", { name: "Code to analyze" })).toBeTruthy();
    const signupRequest = fetchMock.mock.calls.find(([url]) => url === "/api/auth/signup");
    expect(signupRequest[1].credentials).toBe("include");
    expect(signupRequest[1].headers["X-CSRF-Token"]).toBe(csrfToken);
    expect(JSON.parse(signupRequest[1].body)).toEqual({ name: user.name, email: user.email, password: "a-strong-password-12" });
  });
});
