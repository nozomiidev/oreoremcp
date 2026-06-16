export const CONTRACTS = {
  "mcp-client": {
    id: "mcp-client",
    endpoint: "/mcp/client",
    method: "POST",
    description: "MCP Client facade for inbound human intent normalization.",
    payload: {
      type: "object",
      required: ["role", "command", "body"],
      properties: {
        role: {
          type: "string",
          const: "mcp_client"
        },
        command: {
          type: "string",
          const: "intent.normalize"
        },
        body: {
          type: "object",
          required: ["rawInput", "intent", "traceId", "filters", "policy", "operator", "accountBoundary"],
          properties: {
            rawInput: { type: "string" },
            intent: { type: "string" },
            traceId: { type: "string" },
            filters: { type: "array", items: { type: "string" } },
            policy: { type: "string" },
            operator: { type: "string", format: "email" },
            accountBoundary: { type: "string" }
          }
        }
      }
    },
    response: {
      type: "object",
      required: ["actionPlan", "policy", "renderedReply", "traceId", "responder"],
      properties: {
        traceId: { type: "string" },
        responder: { type: "string" },
        policy: { type: "object" },
        actionPlan: {
          type: "array",
          items: { type: "object", properties: { step: { type: "string" }, status: { type: "string" } } }
        },
        renderedReply: { type: "string" }
      }
    }
  },
  "mcp-server": {
    id: "mcp-server",
    endpoint: "/mcp/server",
    method: "POST",
    description: "MCP execution server where a human performs actions through the interface.",
    payload: {
      type: "object",
      required: ["role", "command", "body"],
      properties: {
        role: {
          type: "string",
          const: "mcp_server"
        },
        command: {
          type: "string",
          const: "intent.normalize"
        },
        body: {
          type: "object",
          required: ["rawInput", "intent", "traceId", "filters", "policy", "operator", "accountBoundary"],
          properties: {
            rawInput: { type: "string" },
            intent: { type: "string" },
            traceId: { type: "string" },
            filters: { type: "array", items: { type: "string" } },
            policy: { type: "string" },
            operator: { type: "string", format: "email" },
            accountBoundary: { type: "string" }
          }
        }
      }
    },
    response: {
      type: "object",
      required: ["actionPlan", "policy", "renderedReply", "traceId", "responder"],
      properties: {
        traceId: { type: "string" },
        responder: { type: "string" },
        policy: { type: "object" },
        actionPlan: {
          type: "array",
          items: { type: "object", properties: { step: { type: "string" }, status: { type: "string" } } }
        },
        renderedReply: { type: "string" }
      }
    }
  },
  "openai-api": {
    id: "openai-api",
    endpoint: "/api/openai/v1/chat/completions",
    method: "POST",
    description: "OpenAI-compatible public envelope with intentional human policy gate.",
    payload: {
      type: "object",
      required: ["model", "messages", "metadata"],
      properties: {
        model: { type: "string" },
        messages: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: {
            type: "object",
            required: ["role", "content"],
            properties: {
              role: { type: "string", enum: ["system", "user"] },
              content: { type: "string" }
            }
          }
        },
        metadata: {
          type: "object",
          required: ["intent", "traceId", "filters", "operator", "accountBoundary"],
          properties: {
            intent: { type: "string" },
            traceId: { type: "string" },
            filters: { type: "array", items: { type: "string" } },
            operator: { type: "string", format: "email" },
            accountBoundary: { type: "string" }
          }
        }
      }
    },
    response: {
      type: "object",
      required: ["id", "object", "model", "choices", "policy", "traceId"],
      properties: {
        id: { type: "string" },
        object: { type: "string", const: "chat.completion.preview" },
        model: { type: "string" },
        choices: { type: "array" },
        policy: { type: "object" },
        traceId: { type: "string" }
      }
    }
  }
};
