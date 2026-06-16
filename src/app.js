import {
  buildEnvelope,
  formatJson,
  isModeSupported,
  MODE_SPEC,
  CONTRACTS
} from "./engine.js";
import {
  clearAdminSession,
  getAdminSession,
  getAdminSessionKey,
  isAdminSession,
  sha256Hex,
  unlockAdminSession
} from "./security.js";

const STORAGE_KEYS = {
  traces: "oreoremcp.traceLog",
  operator: "oreoremcp.operator",
  workspaceLease: "oreoremcp.workspaceLease"
};
const WORKSPACE_LEASE_TTL_MS = 45_000;
const APP_INSTANCE_ID = (() => {
  try {
    return crypto?.randomUUID ? crypto.randomUUID() : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  } catch {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
})();

const MODE_ALIASES = {
  "mcp-client": "mcp-client",
  "mcp_client": "mcp-client",
  "mcpclient": "mcp-client",
  "mcp server": "mcp-server",
  "mcp-server": "mcp-server",
  "mcp_server": "mcp-server",
  "mcpserver": "mcp-server",
  "openai-api": "openai-api",
  "openaiapi": "openai-api",
  "opeaiapi": "openai-api",
  "oprenaiapi": "openai-api",
  "openai_api": "openai-api",
  "openai api": "openai-api",
  "ope ai api": "openai-api",
  "api": "openai-api"
};

const elements = {
  form: document.getElementById("persona"),
  input: document.getElementById("goal-input"),
  operator: document.getElementById("operator-account"),
  runButton: document.getElementById("run-intent"),
  copyButton: document.getElementById("copy-request"),
  exportButton: document.getElementById("export-log"),
  clearButton: document.getElementById("clear-log"),
  guardCheckbox: document.getElementById("guard-toggle"),
  guardStatus: document.getElementById("account-status"),
  policyBox: document.getElementById("policy-box"),
  envelopeBox: document.getElementById("envelope-box"),
  responseBox: document.getElementById("response-box"),
  traceList: document.getElementById("trace-list"),
  enterButton: document.getElementById("enter-playground"),
  playground: document.getElementById("playground"),
  contractOpenAI: document.getElementById("contract-openai"),
  contractMcpClient: document.getElementById("contract-client"),
  contractMcpServer: document.getElementById("contract-server"),
  modeStatus: document.getElementById("mode-status"),
  policySummary: document.getElementById("policy-summary"),
  workspaceStatus: document.getElementById("workspace-status"),
  adminPassphrase: document.getElementById("admin-passphrase"),
  adminPrivateKey: document.getElementById("admin-private-key"),
  adminUnlockButton: document.getElementById("admin-unlock"),
  adminLockButton: document.getElementById("admin-lock"),
  adminStatus: document.getElementById("admin-status")
};

const surfacePills = Array.from(
  document.querySelectorAll(".surface-pill[data-surface]:not([data-quick-prompt])")
);
const quickPromptButtons = Array.from(document.querySelectorAll("[data-quick-prompt]"));
const samplePrompts = {
  "mcp-client":
    "Collect the request below and normalize it into a safe MCP Client payload with explicit next-step checkpoints.",
  "mcp-server":
    "Generate a minimal, reversible operations checklist for this release with rollback criteria.",
  "openai-api": "Transform this into a strict OpenAI-style chat request body and include validation notes."
};

let lastResult = null;
let history = [];
let workspaceLeaseTimer = null;

function readHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.traces);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function modePlaceholder(mode) {
  if (mode === "mcp-client") {
    return "Describe intent to be normalized by MCP Client.";
  }
  if (mode === "mcp-server") {
    return "Describe actions for MCP Server to prepare execution guidance.";
  }
  return "Describe user prompt shape for OpenAI-compatible API mode.";
}

function normalizeOperator(rawOperator) {
  return (rawOperator || "").trim().toLowerCase();
}

function persistHistory(nextHistory) {
  try {
    localStorage.setItem(STORAGE_KEYS.traces, JSON.stringify(nextHistory));
    localStorage.setItem(STORAGE_KEYS.operator, normalizeOperator(elements.operator.value));
  } catch {
    // intentionally non-fatal
  }
}

function setStatus(element, text, ok) {
  if (!element) return;
  element.textContent = text;
  element.dataset.ok = String(ok);
}

function formatSessionRemaining(expiresAt) {
  const remainingMs = Math.max(0, expiresAt - Date.now());
  const mins = Math.ceil(remainingMs / 60_000);
  return mins > 0 ? `${mins}min` : "expired";
}

function readWorkspaceLease() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.workspaceLease);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function removeWorkspaceLease() {
  try {
    const lease = readWorkspaceLease();
    if (!lease) return;
    if (lease.owner === APP_INSTANCE_ID) {
      localStorage.removeItem(STORAGE_KEYS.workspaceLease);
    }
  } catch {
    // intentionally non-fatal
  }
}

function claimWorkspaceLease(operator) {
  try {
    const now = Date.now();
    const existing = readWorkspaceLease();
    if (existing && existing.owner !== APP_INSTANCE_ID && existing.expiresAt > now) {
      return { allowed: false, reason: "locked", lease: existing };
    }
    const lease = {
      owner: APP_INSTANCE_ID,
      operator,
      path: window.location.pathname,
      updatedAt: now,
      expiresAt: now + WORKSPACE_LEASE_TTL_MS
    };
    localStorage.setItem(STORAGE_KEYS.workspaceLease, JSON.stringify(lease));
    return { allowed: true, lease };
  } catch {
    return { allowed: false, reason: "storage", lease: null };
  }
}

async function parseAdminPermission() {
  const operator = normalizeOperator(elements.operator.value);
  const session = getAdminSession();
  if (!isAdminSession(session)) {
    return { allowed: false, reason: "session", details: "admin session not found", operator };
  }
  if (!operator) {
    return { allowed: false, reason: "operator-missing", details: "operator identity is required", operator };
  }
  const fingerprint = await sha256Hex(operator);
  const ownerMatch = session.operatorFingerprint === fingerprint;
  if (!ownerMatch) {
    return { allowed: false, reason: "session-owner", details: "session owner mismatch", operator };
  }
  return { allowed: true, reason: "ok", operator, operatorFingerprint: fingerprint };
}

function updateWorkspaceStatus(permission) {
  if (!permission.allowed) {
    if (workspaceLeaseTimer) {
      clearInterval(workspaceLeaseTimer);
      workspaceLeaseTimer = null;
    }
    removeWorkspaceLease();
    elements.runButton.disabled = true;
    if (elements.workspaceStatus) {
    if (permission.reason === "session") {
      elements.workspaceStatus.textContent = "Workspace lock: admin session is not active. Unlock with a private key first.";
    } else if (permission.reason === "operator-missing") {
      elements.workspaceStatus.textContent = "Workspace lock: operator identity is required.";
    } else if (permission.reason === "session-owner") {
      elements.workspaceStatus.textContent = "Workspace lock: admin session owner mismatch.";
    } else {
      elements.workspaceStatus.textContent = "Workspace lock: blocked.";
      }
      elements.workspaceStatus.dataset.ok = "false";
    }
    return { allowed: false, reason: permission.reason };
  }

  const status = claimWorkspaceLease(permission.operator);
  if (!status.allowed) {
    elements.runButton.disabled = true;
    if (elements.workspaceStatus) {
      if (status.reason === "storage") {
        elements.workspaceStatus.textContent = "Workspace lock: local storage unavailable; lock is inactive.";
      } else {
        const holder = status.lease?.owner || "unknown";
        elements.workspaceStatus.textContent = `Workspace lock: another active window (${holder}).`;
      }
      elements.workspaceStatus.dataset.ok = "false";
    }
  } else {
    const expiresAt = getAdminSession()?.expiresAt || Date.now();
    elements.runButton.disabled = false;
    if (!workspaceLeaseTimer) {
      workspaceLeaseTimer = setInterval(() => {
        void evaluateAndRefreshLocks();
      }, Math.max(8_000, Math.floor(WORKSPACE_LEASE_TTL_MS / 5)));
    }
    if (elements.workspaceStatus) {
      elements.workspaceStatus.textContent = `Workspace lock: this window is owner. Session expires in ${formatSessionRemaining(expiresAt)}.`;
      elements.workspaceStatus.dataset.ok = "true";
    }
  }
  return status;
}

function getBoundaryStateText(permission) {
  if (!permission.allowed) {
    if (permission.reason === "session") return "Admin session not unlocked";
    if (permission.reason === "operator-missing") return "Operator identity is required";
    if (permission.reason === "session-owner") return "Admin session does not match current operator";
    return "Boundary blocked";
  }
  return "Admin boundary: authorized";
}

async function evaluateAndRefreshLocks() {
  const permission = await parseAdminPermission();
  setStatus(elements.guardStatus, `Account boundary check: ${getBoundaryStateText(permission)}`, permission.allowed);
  const workspace = updateWorkspaceStatus(permission);
  if (workspace.allowed && elements.workspaceStatus?.dataset.ok !== "true") {
    elements.workspaceStatus.dataset.ok = "true";
  }
}

function appendTrace(entry) {
  const li = document.createElement("li");
  li.textContent = `[${entry.timestamp}] ${entry.mode} / ${entry.intent} / ${entry.operator || "unknown"} / ${entry.traceId}`;
  elements.traceList.appendChild(li);
}

function appendExistingTraces() {
  elements.traceList.textContent = "";
  history.forEach((entry) => appendTrace(entry));
}

function render(result) {
  elements.policyBox.textContent = formatJson(result.policy);
  elements.envelopeBox.textContent = formatJson(result.envelope);
  elements.responseBox.textContent = formatJson(result.response);
  updatePolicySummary(result.policy);
}

function riskLabel(score) {
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
}

function updatePolicySummary(policy) {
  const gate = policy.guardMatch ? "pass" : "blocked";
  const label = riskLabel(policy.riskScore || 0);
  const signals = (policy.blockedSignals || []).length
    ? policy.blockedSignals.join(", ")
    : "none";
  elements.policySummary.textContent = `Policy gate: ${gate} / risk ${label} (${policy.riskScore || 0}) / signals: ${signals}`;
}

async function run() {
  const prompt = (elements.input.value || "").trim();
  if (!prompt) {
    elements.policyBox.textContent = JSON.stringify({ error: "Input is empty. Please type your intent." }, null, 2);
    elements.policySummary.textContent = "Policy gate: input-empty / risk low (0) / signals: none";
    return;
  }

  const operator = normalizeOperator(elements.operator.value);
  const permission = await parseAdminPermission();
  if (!permission.allowed) {
    elements.policyBox.textContent = JSON.stringify(
      {
        error: "Blocked by admin boundary.",
        boundary: permission.operator,
        reason: permission.reason,
        hint: "Unlock the admin session with the operator identity and private key."
      },
      null,
      2
    );
    elements.policySummary.textContent = "Policy gate: blocked / risk high (8) / signals: boundary-lock";
    return;
  }

  const workspace = await evaluateWorkspaceOwnership(permission);
  if (!workspace.allowed) {
    elements.policyBox.textContent = JSON.stringify(
      {
        error: "Workspace is locked by another active OREO REMCP window.",
        boundary: operator,
        hint: "Close or release the other window before continuing."
      },
      null,
      2
    );
    elements.policySummary.textContent = "Policy gate: blocked / risk high (8) / signals: workspace-lock";
    return;
  }

  const mode = safeMode(elements.form.value);
  const result = buildEnvelope({
    mode,
    prompt,
    operator,
    operatorBoundary: operator,
    boundaryVerified: true
  });
  lastResult = result;
  render(result);

  const trace = {
    timestamp: result.policy.timestamp,
    mode: result.response.responder,
    intent: result.policy.intent,
    operator,
    traceId: result.response.traceId
  };

  history = [...history, trace].slice(-300);
  persistHistory(history);
  appendTrace(trace);
  elements.responseBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function evaluateWorkspaceOwnership(permission) {
  const status = updateWorkspaceStatus(permission);
  return status;
}

async function copyLatestEnvelope() {
  if (!lastResult) return;
  try {
    await navigator.clipboard.writeText(formatJson(lastResult.envelope));
    setButtonTransientState(elements.copyButton, "Copied");
  } catch {
    setButtonTransientState(elements.copyButton, "Copy failed");
  }
}

function setButtonTransientState(button, text) {
  const original = button.textContent;
  button.textContent = text;
  button.disabled = true;
  setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1300);
}

function exportTrace() {
  const payload = {
    generatedAt: new Date().toISOString(),
    operatorBoundary: "registered-admin",
    records: history
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "oreoremcp-traces.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function clearAll() {
  history = [];
  persistHistory(history);
  elements.traceList.textContent = "";
  lastResult = null;
  elements.policyBox.textContent = '{ "status": "standby" }';
  elements.envelopeBox.textContent = '{ "status": "standby" }';
  elements.responseBox.textContent = '{ "status": "standby" }';
  elements.policySummary.textContent = "Policy gate: standby";
}

function jumpToPlayground() {
  elements.playground.scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindSurfacePills() {
  surfacePills.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.surface;
      applyMode(mode);
      const quickPrompt = samplePrompts[safeMode(mode)];
      if (quickPrompt) {
        elements.input.value = quickPrompt;
      }
      jumpToPlayground();
      elements.input.focus();
    });
  });
}

function renderContracts() {
  elements.contractMcpClient.textContent = formatJson(CONTRACTS["mcp-client"]);
  elements.contractMcpServer.textContent = formatJson(CONTRACTS["mcp-server"]);
  elements.contractOpenAI.textContent = formatJson(CONTRACTS["openai-api"]);
}

function renderModeHint() {
  const selected = safeMode(elements.form.value);
  const modeName = MODE_SPEC[selected].name;
  const policy = MODE_SPEC[selected].policyIntent;
  const endpoint = MODE_SPEC[selected].endpoint;
  elements.modeStatus.textContent = `Mode: ${modeName} / endpoint ${endpoint} / ${policy}`;
}

function addVisualTransition() {
  const shell = document.getElementById("page-shell");
  shell.classList.remove("loaded");
  requestAnimationFrame(() => shell.classList.add("loaded"));
}

async function handleAdminUnlock() {
  setStatus(elements.adminStatus, "Admin unlock is being validated...", false);
  const operator = normalizeOperator(elements.operator.value);
  try {
    await unlockAdminSession({
      operator,
      passphrase: elements.adminPassphrase.value,
      privateKeyText: elements.adminPrivateKey.value
    });
    const session = getAdminSession();
    if (session) {
      const remaining = formatSessionRemaining(session.expiresAt);
      setStatus(elements.adminStatus, `Admin session unlocked. Expires in ${remaining}.`, true);
      setButtonTransientState(elements.adminUnlockButton, "Unlocked");
      await evaluateAndRefreshLocks();
    } else {
      throw new Error("unlock completed without session storage");
    }
  } catch (error) {
    setStatus(elements.adminStatus, `Admin unlock failed: ${error.message}`, false);
  }
}

function handleAdminLock() {
  clearAdminSession();
  setStatus(elements.adminStatus, "Admin session manually locked.", false);
  void evaluateAndRefreshLocks();
}

function safeMode(value) {
  if (!value) return "openai-api";
  const normalized = String(value).trim().toLowerCase();
  return isModeSupported(MODE_ALIASES[normalized] || normalized) ? MODE_ALIASES[normalized] || normalized : "openai-api";
}

function inferModeFromPath(pathname) {
  const normalized = (pathname || "").toLowerCase();
  if (normalized.includes("mcp-client") || normalized.includes("mcp/client")) return "mcp-client";
  if (normalized.includes("mcp-server") || normalized.includes("mcp/server")) return "mcp-server";
  if (
    normalized.includes("openai-api") ||
    normalized.includes("openaiapi") ||
    normalized.includes("opeaiapi") ||
    normalized.includes("oprenaiapi") ||
    normalized.includes("/api/openai/") ||
    normalized.includes("/openai/v1/")
  )
    return "openai-api";
  return null;
}

function inferInitialModeFromLocation() {
  const url = new URL(window.location.href);
  const queryMode = url.searchParams.get("surface") || url.searchParams.get("mode") || window.__OREO_PRESET_MODE;
  return safeMode(queryMode || inferModeFromPath(url.pathname));
}

function syncModeRoute(mode) {
  const url = new URL(window.location.href);
  url.searchParams.set("surface", mode);
  window.history.replaceState({}, "", url);
}

function applyMode(mode, options = { syncURL: true }) {
  const selected = safeMode(mode);
  elements.form.value = selected;
  elements.input.placeholder = modePlaceholder(selected);
  renderModeHint();
  if (options.syncURL) syncModeRoute(selected);
}

function hydrateOperatorField() {
  const savedOperator = localStorage.getItem(STORAGE_KEYS.operator);
  elements.operator.value = savedOperator || "";
  void evaluateAndRefreshLocks();
}

function fillSamplePrompt(mode) {
  return samplePrompts[safeMode(mode)] || samplePrompts["openai-api"];
}

function bindQuickPrompts() {
  quickPromptButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.surface;
      const override = button.dataset.prompt;
      applyMode(mode);
      elements.input.value = override || fillSamplePrompt(mode);
      jumpToPlayground();
      void run();
    });
  });
}

elements.runButton.addEventListener("click", () => {
  void run();
});
elements.copyButton.addEventListener("click", copyLatestEnvelope);
elements.exportButton.addEventListener("click", exportTrace);
elements.clearButton.addEventListener("click", clearAll);
elements.enterButton.addEventListener("click", jumpToPlayground);
elements.adminUnlockButton?.addEventListener("click", () => {
  void handleAdminUnlock();
});
elements.adminLockButton?.addEventListener("click", () => {
  handleAdminLock();
});

elements.operator.addEventListener("input", () => {
  void evaluateAndRefreshLocks();
});
elements.guardCheckbox.addEventListener("change", () => {
  void evaluateAndRefreshLocks();
});

elements.form.addEventListener("change", () => {
  applyMode(elements.form.value);
});

window.addEventListener("load", () => {
  history = readHistory();
  hydrateOperatorField();
  appendExistingTraces();
  renderContracts();
  applyMode(inferInitialModeFromLocation(), { syncURL: false });
  elements.policySummary.textContent = "Policy gate: standby";
  addVisualTransition();
  bindSurfacePills();
  bindQuickPrompts();
  void evaluateAndRefreshLocks();
});

window.addEventListener("beforeunload", () => {
  removeWorkspaceLease();
});

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEYS.workspaceLease || event.key === getAdminSessionKey()) {
    void evaluateAndRefreshLocks();
  }
});
