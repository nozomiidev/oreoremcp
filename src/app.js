import {
  buildEnvelope,
  formatJson,
  isModeSupported,
  MODE_SPEC,
  CONTRACTS,
  ACCOUNT_BOUNDARY_EMAIL
} from "./engine.js";

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
  workspaceStatus: document.getElementById("workspace-status")
};
let leaseTimer = null;
let workspaceLockedByOther = false;
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

function persistHistory(nextHistory) {
  try {
    localStorage.setItem(STORAGE_KEYS.traces, JSON.stringify(nextHistory));
    localStorage.setItem(STORAGE_KEYS.operator, normalizeOperator(elements.operator.value));
  } catch {
    // intentionally non-fatal
  }
}

function normalizeOperator(rawOperator) {
  return (rawOperator || ACCOUNT_BOUNDARY_EMAIL).trim().toLowerCase();
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

function updateWorkspaceStatus() {
  const operator = normalizeOperator(elements.operator.value);
  if (!isOperatorAllowed(operator)) {
    workspaceLockedByOther = false;
    if (leaseTimer) {
      clearInterval(leaseTimer);
      leaseTimer = null;
    }
    removeWorkspaceLease();
    elements.runButton.disabled = true;
    if (elements.workspaceStatus) {
      elements.workspaceStatus.textContent = "Workspace guard blocked because boundary account is not the operator.";
      elements.workspaceStatus.dataset.ok = "false";
    }
    return { allowed: false, reason: "boundary" };
  }

  const status = claimWorkspaceLease(operator);
  if (!status.allowed) {
    workspaceLockedByOther = true;
    elements.runButton.disabled = true;
  } else {
    workspaceLockedByOther = false;
    elements.runButton.disabled = false;
    if (!leaseTimer) {
      leaseTimer = setInterval(() => {
        updateWorkspaceStatus();
      }, Math.max(8_000, Math.floor(WORKSPACE_LEASE_TTL_MS / 5)));
    }
  }
  if (elements.workspaceStatus) {
    if (workspaceLockedByOther) {
      if (status.reason === "storage") {
        elements.workspaceStatus.textContent = "Workspace lock: local storage unavailable; running in read-only mode is disabled.";
      } else {
        const holder = status.lease?.owner || "unknown";
        elements.workspaceStatus.textContent = `Workspace lock: another active window (${holder}). Wait for lock refresh or close the other window.`;
      }
      elements.workspaceStatus.dataset.ok = "false";
    } else {
      elements.workspaceStatus.textContent = "Workspace lock: this window is owner. Single-operator discipline is active.";
      elements.workspaceStatus.dataset.ok = "true";
    }
  }
  return status;
}

function appendTrace(entry) {
  const li = document.createElement("li");
  li.textContent = `[${entry.timestamp}] ${entry.mode} / ${entry.intent} / ${entry.operator || "unknown"} / ${entry.traceId}`;
  elements.traceList.appendChild(li);
}

function syncGuardStatus() {
  const expected = (elements.operator.value || "").trim().toLowerCase();
  const ok = expected === ACCOUNT_BOUNDARY_EMAIL;
  elements.guardStatus.textContent = ok
    ? "Account boundary check: OK (nozomidevbusin@gmail.com)"
    : `Account boundary check: mismatch (${elements.operator.value || "not set"})`;
  elements.guardStatus.dataset.ok = String(ok);

  updateWorkspaceStatus();
}

function hydrateOperatorField() {
  const savedOperator = localStorage.getItem(STORAGE_KEYS.operator);
  elements.operator.value = savedOperator || ACCOUNT_BOUNDARY_EMAIL;
  syncGuardStatus();
}

function addVisualTransition() {
  const shell = document.getElementById("page-shell");
  shell.classList.remove("loaded");
  requestAnimationFrame(() => shell.classList.add("loaded"));
}

function safeMode(value) {
  if (!value) return "openai-api";
  const normalized = String(value).trim().toLowerCase();
  return isModeSupported(MODE_ALIASES[normalized] || normalized) ? MODE_ALIASES[normalized] || normalized : "openai-api";
}

function normalizeInput() {
  return (elements.input.value || "").trim();
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

function isGuardEnabled() {
  return true;
}

function isOperatorAllowed(operatorValue) {
  if (!isGuardEnabled()) return true;
  return operatorValue.toLowerCase() === ACCOUNT_BOUNDARY_EMAIL;
}

function appendExistingTraces() {
  elements.traceList.textContent = "";
  history.forEach((entry) => appendTrace(entry));
}

function run() {
  const prompt = normalizeInput();
  const currentOperator = (elements.operator.value || ACCOUNT_BOUNDARY_EMAIL).trim().toLowerCase();
  if (!prompt) {
    elements.policyBox.textContent = JSON.stringify({ error: "Input is empty. Please type your intent." }, null, 2);
    elements.policySummary.textContent = "Policy gate: input-empty / risk low (0) / signals: none";
    return;
  }
  if (!isOperatorAllowed(currentOperator)) {
    elements.policyBox.textContent = JSON.stringify(
      {
        error: "Blocked by boundary guard.",
        boundary: ACCOUNT_BOUNDARY_EMAIL,
        observed: currentOperator,
        hint: "Set operator to nozomidevbusin@gmail.com to run."
      },
      null,
      2
    );
    elements.policySummary.textContent = "Policy gate: blocked / risk high (7) / signals: operator-boundary-mismatch";
    return;
  }

  const workspaceStatus = updateWorkspaceStatus();
  if (!workspaceStatus.allowed) {
    elements.policyBox.textContent = JSON.stringify(
      {
        error: "Workspace is locked by another active window.",
        boundary: ACCOUNT_BOUNDARY_EMAIL,
        observed: currentOperator,
        hint: "Close or release the other OREO REMCP window before continuing."
      },
      null,
      2
    );
    elements.policySummary.textContent = "Policy gate: blocked / risk high (8) / signals: workspace-lock";
    return;
  }

  const mode = safeMode(elements.form.value);
  const result = buildEnvelope({ mode, prompt, operator: currentOperator });
  lastResult = result;
  render(result);

  const trace = {
    timestamp: result.policy.timestamp,
    mode: result.response.responder,
    intent: result.policy.intent,
    operator: currentOperator,
    traceId: result.response.traceId
  };

  history = [...history, trace].slice(-300);
  persistHistory(history);
  appendTrace(trace);
  elements.responseBox.scrollIntoView({ behavior: "smooth", block: "center" });
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
    operatorBoundary: ACCOUNT_BOUNDARY_EMAIL,
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

elements.runButton.addEventListener("click", run);
elements.copyButton.addEventListener("click", copyLatestEnvelope);
elements.exportButton.addEventListener("click", exportTrace);
elements.clearButton.addEventListener("click", clearAll);
elements.enterButton.addEventListener("click", jumpToPlayground);

elements.operator.addEventListener("input", syncGuardStatus);
elements.guardCheckbox.addEventListener("change", syncGuardStatus);

elements.form.addEventListener("change", () => {
  applyMode(elements.form.value);
});

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
      run();
    });
  });
}

window.addEventListener("load", () => {
  history = readHistory();
  hydrateOperatorField();
  updateWorkspaceStatus();
  appendExistingTraces();
  renderContracts();
  applyMode(inferInitialModeFromLocation(), { syncURL: false });
  elements.policySummary.textContent = "Policy gate: standby";
  addVisualTransition();
  bindSurfacePills();
  bindQuickPrompts();
});

window.addEventListener("beforeunload", () => {
  removeWorkspaceLease();
});

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEYS.workspaceLease) {
    updateWorkspaceStatus();
  }
});
