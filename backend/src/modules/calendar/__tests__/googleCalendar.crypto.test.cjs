const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../googleCalendar.crypto.js");
const run = (script, key) => execFileSync(process.execPath, ["--input-type=module", "-e", script], {
  env: { ...process.env, GOOGLE_TOKEN_ENCRYPTION_KEY: key },
  encoding: "utf8",
});

describe("Google Calendar token encryption", () => {
  test("round-trips with authenticated encryption and keeps token opaque", () => {
    const key = crypto.randomBytes(32).toString("base64");
    const script = `import { encryptGoogleToken, decryptGoogleToken } from ${JSON.stringify(`file://${sourcePath.replaceAll("\\", "/")}`)}; const token = "refresh-token-sensitive-value"; const envelope = encryptGoogleToken(token); if (envelope.includes(token) || decryptGoogleToken(envelope) !== token) process.exit(2); console.log(envelope);`;
    const envelope = run(script, key).trim();
    expect(envelope).not.toContain("refresh-token-sensitive-value");
  });

  test("rejects tampered ciphertext and malformed keys", () => {
    const key = crypto.randomBytes(32).toString("base64");
    const badKey = Buffer.alloc(8).toString("base64");
    const script = `import { encryptGoogleToken, decryptGoogleToken } from ${JSON.stringify(`file://${sourcePath.replaceAll("\\", "/")}`)}; const parts = encryptGoogleToken("token").split("."); parts[3] = Buffer.from("tampered").toString("base64url"); let rejected = false; try { decryptGoogleToken(parts.join(".")); } catch { rejected = true; } if (!rejected) process.exit(2);`;
    expect(() => run(script, key)).not.toThrow();
    const badKeyScript = `import { encryptGoogleToken } from ${JSON.stringify(`file://${sourcePath.replaceAll("\\", "/")}`)}; try { encryptGoogleToken("token"); process.exit(2); } catch (error) { if (!error.message.includes("32-byte")) process.exit(3); }`;
    expect(() => run(badKeyScript, badKey)).not.toThrow();
  });
});
