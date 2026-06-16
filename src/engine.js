import { CONTRACTS } from "./contracts.js";

const INJECTION_PATTERNS = [
  /ignore (all|previous) instructions/gi,
  /\byou are now\b/gi,
  /\bact as\b/gi,
  /jailbreak/gi,
  /system prompt/gi,
  /override system/gi,
  /ignore any safety/gi,
  /disregard policy/gi
];

const MODE_SPEC = {
  "mcp-client": {
    name: "Ore no MCP Client",
    role: "mcp_client",
    endpoint: "/mcp/client",
    tone:
      "You are the MCP Client ingress endpoint. Normalize incoming intent and present safe, operator-friendly action candidates.",
    policyIntent: "Human decision required; intent capture first, execution second."
  },
  "mcp-server": {
    name: "Ore no MCP Server",
    role: "mcp_server",
    endpoint: "/mcp/server",
    tone:
      "You are the MCP Server execution surface. The operator confirms steps manually, and every step is traceable.",
    policyIntent: "Human in the loop for each operational step with audit trail."
  },
  "openai-api": {
    name: "Ore no OpenAI API",
    role: "openai_api",
    endpoint: "/api/openai/v1/chat/completions",
    tone:
      "You are the public OpenAI-compatible layer. You do not replace the operator; you emit a safe request envelope.",
    policyIntent: "Safe OpenAI-style request/response contract with human confirmation."
  }
};

const INTENT_RULES = {
  operational: [
    /deploy|release|publish|setup|build|lint|test|debug|execute|ship|rollback/i,
    /デプロイ|リリース|公開|構築|実行|検証/i
  ],
  orchestration: [/mcp|tool|workflow|task|execution|plan|orchestrate/i, /調整|運用|オーケストレーション|段取り/i],
  creation: [/create|draft|outline|propose|design|plan|prototype|implement|generate|compose/i, /作成|草案|デザイン|生成|設計/i],
  support: [/support|help|error|issue|troubleshoot|why|what|how|failure/i, /サポート|ヘルプ|エラー|失敗|原因|なぜ/i],
  api: [/api|endpoint|request|response|json|schema|openai|chat completion|payload/i, /スキーマ|エンドポイント|リクエスト|レスポンス/i]
};

export function sanitizePrompt(input) {
  const original = typeof input === "string" ? input : "";
  let sanitized = original.replace(/[\u0000-\u001f]/g, " ").trim();
  const blockedSignals = [];
  let riskScore = 0;

  INJECTION_PATTERNS.forEach((pattern) => {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, "[FILTERED]");
      blockedSignals.push(pattern.source);
      riskScore += 2;
    }
  });

  if (/<script|javascript:/i.test(sanitized)) {
    sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "[SANITIZED_SCRIPT]");
    blockedSignals.push("script_or_uri");
    riskScore += 3;
  }

  if (/[<>{}[\]]/.test(sanitized)) {
    sanitized = sanitized.replace(/[<>{}[\]]/g, "");
    blockedSignals.push("bracket_token");
    riskScore += 1;
  }

  if (/[`$]/.test(sanitized)) {
    sanitized = sanitized.replace(/[`$]/g, "");
    blockedSignals.push("shell_token");
    riskScore += 1;
  }

  if (/(https?:\/\/|file:\/\/|data:)/i.test(sanitized)) {
    sanitized = sanitized.replace(/(https?:\/\/|file:\/\/|data:)[^\s]+/gi, "[URL]");
    blockedSignals.push("url_token");
    riskScore += 1;
  }

  if (sanitized.length > 1200) {
    sanitized = sanitized.slice(0, 1200);
    blockedSignals.push("length_capped");
    riskScore += 1;
  }

  return {
    sanitized,
    blockedSignals,
    riskScore: Math.min(10, riskScore)
  };
}

export function classifyIntent(prompt) {
  const text = typeof prompt === "string" ? prompt : "";
  const lower = text.toLowerCase();
  for (const [intent, patterns] of Object.entries(INTENT_RULES)) {
    if (patterns.some((pattern) => pattern.test(text))) {
      return intent;
    }
  }
  if (lower.includes("what") || lower.includes("why")) {
    return "support";
  }
  return "creation";
}

export function buildEnvelope({ mode, prompt, operator = "", operatorBoundary = "", boundaryVerified = false }) {
  const safeMode = MODE_SPEC[mode] ? mode : "openai-api";
  const persona = MODE_SPEC[safeMode];
  const contract = CONTRACTS[safeMode];
  const safeOperator = String(operator || "").trim().toLowerCase();
  const safeBoundary = String(operatorBoundary || "").trim().toLowerCase();
  const policyBoundary = safeBoundary || "admin-lock";
  const guardMatch = boundaryVerified && Boolean(safeBoundary) && safeBoundary === safeOperator;

  const { sanitized, blockedSignals, riskScore } = sanitizePrompt(prompt);
  const intent = classifyIntent(sanitized);
  const traceId = buildTraceId();
  const timestamp = new Date().toISOString();

  const policy = {
    sanitized,
    blockedSignals,
    riskScore,
    allowedMode: safeMode,
    intent,
    source: "human-in-the-loop-ui",
    tone: persona.tone,
    timestamp,
    operator: safeOperator,
    policyIntent: persona.policyIntent,
    accountBoundary: policyBoundary,
    guardMatch
  };

  const commonPayload = {
    intent,
    traceId,
    filters: blockedSignals,
    operator: safeOperator,
    accountBoundary: policyBoundary,
    policyIntent: persona.policyIntent
  };

  const envelope =
    safeMode === "openai-api"
      ? {
          endpoint: contract.endpoint,
          method: contract.method,
          contractId: contract.id,
          payload: {
            model: "human-loop/surface-model",
            messages: [
              {
                role: "system",
                content: persona.tone
              },
              {
                role: "user",
                content: sanitized
              }
            ],
            metadata: commonPayload
          }
        }
      : {
          endpoint: contract.endpoint,
          method: contract.method,
          contractId: contract.id,
          payload: {
            role: persona.role,
            command: "intent.normalize",
            body: {
              rawInput: sanitized,
              policy: persona.policyIntent,
              ...commonPayload
            }
          }
        };

  const response = {
    mode: safeMode,
    responder: persona.name,
    traceId,
    policy,
    actionPlan: computeActionPlan(intent),
    renderedReply: buildReply({ persona, intent, prompt: sanitized, operatorBoundary: policyBoundary, boundaryVerified: guardMatch })
  };

  if (safeMode === "openai-api") {
    response.openAiCompatible = {
      id: `oai-${traceId}`,
      traceId,
      object: "chat.completion.preview",
      model: "human-loop/surface-model",
      policy: policy,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: buildReply({ persona, intent, prompt: sanitized, operatorBoundary: policyBoundary, boundaryVerified: guardMatch })
          },
          finish_reason: "human_filtered"
        }
      ]
    };
  }

  return { envelope, policy, response, contract };
}

function buildReply({ intent, persona, prompt, boundaryVerified }) {
  const base = {
    operational:
      "Operational intent received. Next step: create a concise execution checklist with risk, permission, and rollback notes.",
    orchestration:
      "Orchestration intent received. Breaking down workflow, dependencies, and minimum-impact sequence.",
    creation:
      "Creative request received. I will output goal, acceptance criteria, deliverables, and validation checklist.",
    support:
      "Support request received. I will return troubleshooting sequence, evidence first, and confirmation actions.",
    api: "API contract intent received. I will include schema alignment, fallback path, and retry behavior."
  };
  const message = base[intent] || base.creation;
  const personaPrefix =
    persona.role === "openai_api"
      ? "[OpenAI API Facade]"
      : persona.role === "mcp_client"
        ? "[MCP Client]"
        : "[MCP Server]";
  const boundaryStatus = boundaryVerified ? "admin session verified" : "admin boundary locked";

  return `${personaPrefix} ${message}\nInput summary: ${truncate(prompt, 160)}\nBoundary account: ${boundaryStatus}`;
}

function computeActionPlan(intent) {
  const common = [
    { step: "Intent confirmed", status: "done" },
    { step: "Permission scope check", status: "next" },
    { step: "Audit log captured", status: "next" },
    { step: "Execution plan drafted", status: "next" }
  ];
  const extras = {
    operational: [{ step: "Test + rollback plan", status: "next" }],
    orchestration: [{ step: "Dependency and toolchain check", status: "next" }],
    creation: [{ step: "Template generation for output", status: "next" }],
    support: [{ step: "Triage question list", status: "next" }],
    api: [{ step: "Payload schema validation", status: "next" }]
  };
  return [...common, ...(extras[intent] || [])];
}

function truncate(value, maxLen) {
  const raw = String(value ?? "");
  return raw.length <= maxLen ? raw : `${raw.slice(0, maxLen - 3)}...`;
}

function buildTraceId() {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `trace_${time}_${random}`;
}

export function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

export function isModeSupported(mode) {
  return Object.prototype.hasOwnProperty.call(MODE_SPEC, mode);
}

export { MODE_SPEC, CONTRACTS };
