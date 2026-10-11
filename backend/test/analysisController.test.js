const { after, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const { createAnalyzeRateLimiter } = require("../middleware/analyzeRateLimit");
const { errorHandler } = require("../middleware/errorHandler");
const { requestLogger } = require("../middleware/requestLogger");
const { createRequireAuth } = require("../middleware/requireAuth");

const openrouterPath = require.resolve("../config/openrouter");
const cachedOpenrouter = require.cache[openrouterPath];
let mockedClient;
let providerSetupError = null;

require.cache[openrouterPath] = {
  id: openrouterPath,
  filename: openrouterPath,
  loaded: true,
  exports: {
    getOpenRouterClient: () => {
      if (providerSetupError) throw providerSetupError;
      return mockedClient;
    },
  },
};

const { analyzeCode } = require("../controllers/analysisController");
const app = require("../server");

after(() => {
  if (cachedOpenrouter) require.cache[openrouterPath] = cachedOpenrouter;
  else delete require.cache[openrouterPath];
});

beforeEach(() => {
  providerSetupError = null;
  mockedClient = {
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content: "## Result\nDone." } }] }),
      },
    },
  };
});

async function callController(body) {
  const response = {
    statusCode: null,
    data: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
  };

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await analyzeCode({ body }, response);
  } finally {
    console.error = originalConsoleError;
  }
  return response;
}

test("rejects empty code before contacting the provider", async () => {
  let called = false;
  mockedClient.chat.completions.create = async () => { called = true; };

  const response = await callController({ code: "  ", language: "javascript", action: "explain" });

  assert.equal(response.statusCode, 400);
  assert.equal(response.data.message, "Please provide code to analyze.");
  assert.equal(called, false);
});

test("returns analysis and applies the provider timeout", async () => {
  let requestOptions;
  mockedClient.chat.completions.create = async (_payload, options) => {
    requestOptions = options;
    return { choices: [{ message: { content: "## Tests\n- works" } }] };
  };

  const response = await callController({ code: "function add(a, b) { return a + b; }", language: "javascript", action: "tests" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.data.action, "tests");
  assert.match(response.data.result, /## Tests/);
  assert.equal(requestOptions.timeout, 45_000);
});

test("maps provider rate limits to HTTP 429 with a useful message", async () => {
  mockedClient.chat.completions.create = async () => {
    const error = new Error("rate limited");
    error.status = 429;
    throw error;
  };

  const response = await callController({ code: "x", language: "javascript", action: "debug" });

  assert.equal(response.statusCode, 429);
  assert.match(response.data.message, /rate-limiting/);
});

test("maps provider timeouts to HTTP 504", async () => {
  mockedClient.chat.completions.create = async () => {
    const error = new Error("timeout");
    error.name = "APIConnectionTimeoutError";
    throw error;
  };

  const response = await callController({ code: "x", language: "javascript", action: "explain" });

  assert.equal(response.statusCode, 504);
  assert.match(response.data.message, /too long to respond/);
});

test("does not expose a missing provider key detail", async () => {
  providerSetupError = new Error("OPENROUTER_API_KEY is not configured");
  const response = await callController({ code: "x", language: "javascript", action: "optimize" });

  assert.equal(response.statusCode, 503);
  assert.equal(response.data.message, "AI analysis is not configured on the server yet.");
  assert.doesNotMatch(response.data.message, /OPENROUTER_API_KEY/);
});

test("limits analysis requests per client and resets the window", () => {
  let now = 1_000;
  const limit = createAnalyzeRateLimiter({ windowMs: 60_000, maxRequests: 2, now: () => now });
  const call = () => {
    const response = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      status(statusCode) { this.statusCode = statusCode; return this; },
      json(data) { this.data = data; return this; },
    };
    let nextCalled = false;
    limit({ ip: "127.0.0.1" }, response, () => { nextCalled = true; });
    return { response, nextCalled };
  };

  assert.equal(call().nextCalled, true);
  assert.equal(call().nextCalled, true);
  const limited = call();
  assert.equal(limited.nextCalled, false);
  assert.equal(limited.response.statusCode, 429);
  assert.equal(limited.response.headers["Retry-After"], "60");

  now += 60_000;
  assert.equal(call().nextCalled, true);
});

test("auth guard returns 503 when Clerk server keys are not configured", () => {
  const requireAuth = createRequireAuth({ isConfigured: () => false });
  const response = {
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(data) { this.data = data; return this; },
  };

  requireAuth({}, response, () => assert.fail("must not continue without auth configuration"));

  assert.equal(response.statusCode, 503);
  assert.match(response.data.message, /not configured/);
});

test("auth guard rejects anonymous callers and attaches the authenticated user ID", () => {
  const response = {
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(data) { this.data = data; return this; },
  };
  const rejectAnonymous = createRequireAuth({
    isConfigured: () => true,
    getAuthForRequest: () => ({ isAuthenticated: false, userId: null }),
  });
  rejectAnonymous({}, response, () => assert.fail("anonymous callers must be rejected"));
  assert.equal(response.statusCode, 401);

  const req = {};
  let nextCalled = false;
  const allowSignedIn = createRequireAuth({
    isConfigured: () => true,
    getAuthForRequest: () => ({ isAuthenticated: true, userId: "user_test_123" }),
  });
  allowSignedIn(req, response, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.authUserId, "user_test_123");
});

test("formats invalid JSON errors without returning parser details", () => {
  const error = new SyntaxError("sensitive parser detail");
  error.status = 400;
  error.body = "malformed request";
  const response = {
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(data) { this.data = data; return this; },
  };
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    errorHandler(error, { requestId: "test-request" }, response, () => {});
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 400);
  assert.equal(response.data.requestId, "test-request");
  assert.equal(response.data.message, "Request body must be valid JSON.");
  assert.doesNotMatch(JSON.stringify(response.data), /sensitive parser detail/);
});

test("logs request metadata and assigns a request ID without logging the body", () => {
  const response = {
    headers: {},
    listeners: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    on(event, callback) { this.listeners[event] = callback; },
  };
  const request = { method: "POST", path: "/api/analyze", body: { code: "private source" } };
  const originalConsoleLog = console.log;
  let logLine;
  console.log = (line) => { logLine = line; };
  try {
    requestLogger(request, response, () => {});
    response.listeners.finish();
  } finally {
    console.log = originalConsoleLog;
  }

  const logRecord = JSON.parse(logLine);
  assert.match(request.requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(response.headers["X-Request-Id"], request.requestId);
  assert.equal(logRecord.path, "/api/analyze");
  assert.equal(logRecord.requestId, request.requestId);
  assert.doesNotMatch(logLine, /private source/);
});

test("serves request IDs and JSON parser errors, and requires auth for analysis", async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  console.log = () => {};
  console.error = () => {};

  try {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.match(health.headers.get("x-request-id"), /^[0-9a-f-]{36}$/i);

    const malformed = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad json",
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).message, "Request body must be valid JSON.");

    const oversized = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "x".repeat(110 * 1024) }),
    });
    assert.equal(oversized.status, 413);
    assert.match((await oversized.json()).message, /too large/);

    const anonymousAnalysis = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "", language: "javascript", action: "explain" }),
    });
    assert.equal(anonymousAnalysis.status, 503);
    assert.match((await anonymousAnalysis.json()).message, /Sign-in is not configured/);
  } finally {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
