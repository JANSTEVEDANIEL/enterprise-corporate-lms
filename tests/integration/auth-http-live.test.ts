import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

describe("Adversarial Live HTTP Server — Auth & Session Resolution", () => {
  const PORT = 3921;
  const BASE_URL = `http://127.0.0.1:${PORT}`;
  let serverProcess: ChildProcess;

  before(async () => {
    // Start Next.js production server on isolated port
    const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");
    serverProcess = spawn(nextBin, ["start", "-p", String(PORT), "-H", "127.0.0.1"], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" },
      stdio: "pipe",
    });

    let serverLogs = "";
    serverProcess.stdout?.on("data", (d) => { serverLogs += d.toString(); });
    serverProcess.stderr?.on("data", (d) => { serverLogs += d.toString(); });

    // Wait until server is ready to accept HTTP connections
    let ready = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((res) => setTimeout(res, 250));
      try {
        const res = await fetch(`${BASE_URL}/api/auth/session`);
        if (res.status === 200) {
          ready = true;
          break;
        }
      } catch {
        // server not ready yet
      }
    }

    if (!ready) {
      serverProcess.kill("SIGKILL");
      throw new Error(`Next.js server failed to start on port ${PORT}. Logs: ${serverLogs}`);
    }
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
  });

  // ==========================================================================
  // 1. LIVE HTTP SESSION RESOLUTION
  // ==========================================================================
  it("1. Unauthenticated request resolves to DEFAULT_USER (Alex Rivera, EMPLOYEE)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/session`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.currentUser.id, "usr_alex_rivera");
    assert.strictEqual(json.data.currentUser.role, "EMPLOYEE");
  });

  it("2. Request with x-lms-user-id header resolves specified persona (Marcus Vance, COMPLIANCE_OFFICER)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: {
        "x-lms-user-id": "usr_marcus_vance",
      },
    });
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.currentUser.id, "usr_marcus_vance");
    assert.strictEqual(json.data.currentUser.role, "COMPLIANCE_OFFICER");
  });

  it("3. Request with lms_user_id cookie resolves specified persona (Sarah Jenkins, MANAGER)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: {
        Cookie: "lms_user_id=usr_sarah_jenkins",
      },
    });
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.currentUser.id, "usr_sarah_jenkins");
    assert.strictEqual(json.data.currentUser.role, "MANAGER");
  });

  it("4. Header takes precedence over cookie when both are supplied", async () => {
    // Cookie says Alex Rivera (EMPLOYEE), Header says David Kim (SUPER_ADMIN)
    const res = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: {
        Cookie: "lms_user_id=usr_alex_rivera",
        "x-lms-user-id": "usr_david_kim",
      },
    });
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.currentUser.id, "usr_david_kim");
    assert.strictEqual(json.data.currentUser.role, "SUPER_ADMIN");
  });

  it("5. Malicious or non-existent cookie safely falls back to DEFAULT_USER without crashing", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: {
        Cookie: "lms_user_id=usr_attacker_spoofed_session",
      },
    });
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.currentUser.id, "usr_alex_rivera");
    assert.strictEqual(json.data.currentUser.role, "EMPLOYEE");
  });

  // ==========================================================================
  // 2. LIVE HTTP PERSONA SWITCHING & COOKIE PROPAGATION
  // ==========================================================================
  it("6. Persona switch via POST sets lms_user_id cookie and subsequent GET reflects new identity", async () => {
    // Step 1: Switch to Elena Rostova (EMPLOYEE, Security)
    const switchRes = await fetch(`${BASE_URL}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "usr_elena_rostova" }),
    });

    assert.strictEqual(switchRes.status, 200);
    const switchJson = await switchRes.json();
    assert.strictEqual(switchJson.success, true);
    assert.strictEqual(switchJson.data.user.id, "usr_elena_rostova");

    // Extract cookie from Set-Cookie header
    const setCookie = switchRes.headers.get("set-cookie");
    assert.ok(setCookie, "Response must include Set-Cookie header");
    assert.match(setCookie, /lms_user_id=usr_elena_rostova/);
    assert.match(setCookie, /Path=\//i);
    assert.match(setCookie, /Max-Age=2592000/i);

    // Step 2: Use returned cookie in subsequent GET request
    const getRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: {
        Cookie: "lms_user_id=usr_elena_rostova",
      },
    });
    assert.strictEqual(getRes.status, 200);
    const getJson = await getRes.json();
    assert.strictEqual(getJson.data.currentUser.id, "usr_elena_rostova");
    assert.strictEqual(getJson.data.currentUser.department, "Security");
  });

  it("7. POST /api/auth/session rejects missing userId with 400 Bad Request", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error, "userId is required");
  });

  it("8. POST /api/auth/session rejects non-existent userId with 404 Not Found", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "usr_nonexistent_hacker" }),
    });

    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error, "User not found");
  });

  it("9. POST /api/auth/session safely rejects SQL injection in userId with 404", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "usr_alex_rivera' OR 1=1 --" }),
    });

    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.success, false);
  });
});
