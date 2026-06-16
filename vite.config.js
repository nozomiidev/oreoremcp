import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, "index.html"),
        mcpClientLegacy: resolve(rootDir, "mcp-client.html"),
        mcpServerLegacy: resolve(rootDir, "mcp-server.html"),
        openaiApiRootAlias: resolve(rootDir, "openaiapi.html"),
        openaiApiTypoRootAlias: resolve(rootDir, "opeaiapi.html"),
        openaiApiTypoRootAlias2: resolve(rootDir, "oprenaiapi.html"),
        openaiApiLegacy: resolve(rootDir, "openai-api.html"),
        openaiApiAlias: resolve(rootDir, "openaiapi/index.html"),
        openaiApiTypoAlias: resolve(rootDir, "opeaiapi/index.html"),
        openaiApiTypoAlias2: resolve(rootDir, "oprenaiapi/index.html"),
        mcpClientRoute: resolve(rootDir, "mcp/client/index.html"),
        mcpServerRoute: resolve(rootDir, "mcp/server/index.html"),
        openaiRoute: resolve(rootDir, "api/openai/v1/chat/completions/index.html")
      }
    }
  },
  test: {
    environment: "jsdom"
  }
});
