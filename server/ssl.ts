import fs from "fs";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const selfsigned = require("selfsigned");

/**
 * Generates (or reads existing) a self-signed TLS certificate for local HTTPS.
 * Certs are stored in /certs/ (add to .gitignore).
 * Not used in production — nginx handles SSL termination.
 */
export function getSSLOptions(): { key: Buffer; cert: Buffer } {
  const certsDir = path.resolve(__dirname, "../certs");
  const keyPath = path.join(certsDir, "key.pem");
  const certPath = path.join(certsDir, "cert.pem");

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    fs.mkdirSync(certsDir, { recursive: true });
    const attrs = [{ name: "commonName", value: "localhost" }];
    const pems = selfsigned.generate(attrs, {
      days: 365,
      algorithm: "sha256",
      keySize: 2048,
    });
    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);
    console.log(`[ssl] Self-signed certificate generated at ${certsDir}`);
    console.log("[ssl] To avoid browser warnings, import certs/cert.pem into your OS trust store.");
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}
