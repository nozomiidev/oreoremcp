const ADMIN_PUBLIC_KEY_JWK = {
  alg: "RSA-OAEP-256",
  e: "AQAB",
  ext: true,
  key_ops: ["encrypt"],
  kty: "RSA",
  n: "zG2r-pRPKB7Httrcu-OYHrliBYxzQzdjRAC6fT7IP9m-O8rpqk2CHAHdFT0MhNgkac58N45CUPQdbQRHxBIS2yjUhbicRbvi7QX_1f5hZK2afMJLdeihTsUhpnA7g38P4OaDeg9iZSppK3EBddq7con4cmOnpKhJFaEM5Pm_N8F4doe-QF-kicQJehPoH3_jCMraZDD8SxYL5E6opvLKvsYssgvTtwMqNNq1EpXXs5KKxPkcVo8U2ZFjbx2TaEfbB7II0lXvCNvkP77RbPyb5OHGXlSd8DfQ8HBBNstJOFNS0-mXTe1tWh9UYkVzFlN4bxb-pN9M7_sw__zrXer_73AxbFV0Czt95LHqHqF-4bdNMflOuUM50M5x2X0DvizUtqVoEnazIoa9dP1hu0tVGVaJzl5Cbt_YH36JXyCKRyPR1e-g1xKA33JLk0XATUsxsGETK6vJtKHwLyzzJWjGY_ghNOYRxPtJXIna_pMfUR9ufYGg5QcJNTT319BwZqljd9MylvyhnW4y3VwIVcwQbVS_Hw2bB63PkmKe063SssPLmqWF7if7Guy8zDn9A2RplFq97kOrxDNPuHD1q_DofDGsLTTO5PRdfiWe11FGUGq00-c0pjQZhs5JiRbS2Ml93-e_bINGgH-4HOlObB9cjl3ZLmL4sPUeRdwCYON5828"
};

const ADMIN_SESSION_KEY = "oreoremcp.adminSession";
const ADMIN_SESSION_TTL_MS = 45 * 60 * 1000;
const ADMIN_MIN_PASSPHRASE_LENGTH = 8;
const ALLOWLIST_PRIVATE_KEY_ALGS = new Set(["RSA-OAEP-256", "@github"]);

const encoder = new TextEncoder();
let cachedPublicKey = null;

function normalizeOperator(value) {
  return String(value || "").trim().toLowerCase();
}

function uint8ToBase64Url(value) {
  const chunks = [];
  for (let i = 0; i < value.length; i += 1) {
    chunks.push(String.fromCharCode(value[i]));
  }
  const binary = chunks.join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function uint8ToHex(value) {
  return Array.from(value).map((item) => item.toString(16).padStart(2, "0")).join("");
}

function isEqualBytes(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) {
    result |= left[i] ^ right[i];
  }
  return result === 0;
}

export function getAdminSessionKey() {
  return ADMIN_SESSION_KEY;
}

export function getAdminSessionTtlMs() {
  return ADMIN_SESSION_TTL_MS;
}

export async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto is unavailable.");
  }
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(value || "")));
  return uint8ToHex(new Uint8Array(digest));
}

export function isAdminSession(session) {
  if (!session || typeof session !== "object") return false;
  if (session.v !== 1) return false;
  if (typeof session.operatorFingerprint !== "string" || !session.operatorFingerprint) return false;
  if (typeof session.expiresAt !== "number" || session.expiresAt <= Date.now()) return false;
  return true;
}

export function getAdminSession() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isAdminSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistAdminSession(session) {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

async function importPublicKey(overrideKey) {
  if (cachedPublicKey) return cachedPublicKey;
  const keySource = overrideKey || ADMIN_PUBLIC_KEY_JWK;
  const key = await crypto.subtle.importKey(
    "jwk",
    keySource,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
  cachedPublicKey = key;
  return key;
}

function parsePrivateKey(rawKey) {
  let parsed;
  try {
    parsed = typeof rawKey === "string" ? JSON.parse(rawKey) : rawKey;
  } catch {
    throw new Error("Private key input format is invalid.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Private key input format is invalid.");
  }
  if (parsed.kty !== "RSA") {
    throw new Error("Private key must be RSA.");
  }
  if (!parsed.d || !parsed.n || !parsed.e || !parsed.p || !parsed.q || !parsed.dp || !parsed.dq || !parsed.qi) {
    throw new Error("Private key is incomplete.");
  }
  const alg = parsed.alg || "RSA-OAEP-256";
  if (!ALLOWLIST_PRIVATE_KEY_ALGS.has(alg)) {
    throw new Error("Unsupported private key algorithm.");
  }
  if (!Array.isArray(parsed.key_ops) || !parsed.key_ops.includes("decrypt")) {
    throw new Error("Private key must allow decrypt usage.");
  }
  if (alg === "@github") {
    parsed = {
      ...parsed,
      alg: "RSA-OAEP-256"
    };
  }
  return parsed;
}

function buildChallengeFingerprint(challenge, passphrase) {
  const phrase = `${uint8ToBase64Url(challenge)}|${String(passphrase || "")}|OREO-REMCP-ADMIN`;
  return encoder.encode(phrase);
}

async function challengeProof(challenge, passphrase) {
  const source = buildChallengeFingerprint(challenge, passphrase);
  const hash = await crypto.subtle.digest("SHA-256", source);
  return new Uint8Array(hash);
}

export async function unlockAdminSession({ operator, passphrase, privateKeyText }) {
  const normalizedOperator = normalizeOperator(operator);
  if (!normalizedOperator) {
    throw new Error("Operator identity is required.");
  }
  if (!passphrase || String(passphrase).trim().length < ADMIN_MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${ADMIN_MIN_PASSPHRASE_LENGTH} characters.`);
  }
  if (!privateKeyText || !String(privateKeyText).trim()) {
    throw new Error("Private key text is required.");
  }

  const privateKeyJwk = parsePrivateKey(privateKeyText);
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const proof = await challengeProof(challenge, passphrase);
  const publicKey = await importPublicKey();
  const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, proof);

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );
  const decrypted = new Uint8Array(await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, encrypted));
  if (!isEqualBytes(decrypted, proof)) {
    throw new Error("Private key mismatch.");
  }

  const now = Date.now();
  const session = {
    v: 1,
    operatorFingerprint: await sha256Hex(normalizedOperator),
    unlockedAt: now,
    expiresAt: now + ADMIN_SESSION_TTL_MS,
    proofNonce: uint8ToBase64Url(challenge)
  };
  persistAdminSession(session);
  return session;
}
