import { test, expect } from "@playwright/test";

test("landing and cockpit are usable from browser", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await page.locator("#enter-playground").click();
  await expect(page.locator("#playground")).toBeInViewport();
});

test("schema panels and intent execution flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#contract-openai")).toContainText("/api/openai/v1/chat/completions");
  await page.locator("#operator-account").fill("nozomidevbusin@gmail.com");
  await page.locator("#persona").selectOption("mcp-server");
  await page.locator("#goal-input").fill("Prepare safe deployment check steps.");
  await page.locator("#run-intent").click();

  await expect(page.locator("#policy-box")).toContainText('"allowedMode"');
  await expect(page.locator("#envelope-box")).toContainText('"/mcp/server"');
  await expect(page.locator("#response-box")).toContainText("MCP Server");
  await expect(page.locator("#trace-list li")).toHaveCount(1);
});

test("surface pills route to the matching public mode", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-surface="mcp-server"]:not([data-quick-prompt])').click();
  await expect(page.locator("#mode-status")).toContainText("Ore no MCP Server");
  await page.locator("#goal-input").fill("Draft a safe execution checklist.");
  await page.locator("#run-intent").click();
  await expect(page.locator("#envelope-box")).toContainText('"/mcp/server"');
});

test("query param surface selects initial mode", async ({ page }) => {
  await page.goto("/?surface=mcp-client");
  await expect(page.locator("#mode-status")).toContainText("Ore no MCP Client");
});

test("legacy alias parameter still maps to OpenAI API surface", async ({ page }) => {
  await page.goto("/?surface=opeaiapi");
  await expect(page.locator("#mode-status")).toContainText("Ore no OpenAI API");
});

test("openaiapi alias parameter maps to OpenAI API surface", async ({ page }) => {
  await page.goto("/?surface=openaiapi");
  await expect(page.locator("#mode-status")).toContainText("Ore no OpenAI API");
});

test("openaiapi typo alias surface parameter still maps to OpenAI API", async ({ page }) => {
  await page.goto("/?surface=oprenaiapi");
  await expect(page.locator("#mode-status")).toContainText("Ore no OpenAI API");
});

test("quick prompts execute the selected mode flow", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-quick-prompt][data-surface="openai-api"]').click();
  await expect(page.locator("#mode-status")).toContainText("Ore no OpenAI API");
  await expect(page.locator("#envelope-box")).toContainText('"/api/openai/v1/chat/completions"');
  await expect(page.locator("#response-box")).toContainText("OpenAI API");
  await expect(page.locator("#policy-summary")).toContainText("Policy gate");
});

test("surface entry pages map to their route", async ({ page }) => {
  await page.goto("/mcp/client/");
  await expect(page.locator("#mode-status")).toContainText("Ore no MCP Client");
});

test("mcp-server route maps to execution surface", async ({ page }) => {
  await page.goto("/mcp/server/");
  await expect(page.locator("#mode-status")).toContainText("Ore no MCP Server");
});

test("openai route endpoint maps to openai facade", async ({ page }) => {
  await page.goto("/api/openai/v1/chat/completions/");
  await expect(page.locator("#mode-status")).toContainText("Ore no OpenAI API");
});

test("openai alias path maps to openai facade", async ({ page }) => {
  await page.goto("/openaiapi/");
  await expect(page.locator("#mode-status")).toContainText("Ore no OpenAI API");
});

test("openai alias root path maps to openai facade", async ({ page }) => {
  await page.goto("/openaiapi");
  await expect(page.locator("#mode-status")).toContainText("Ore no OpenAI API");
});

test("opeaiapi root path maps to openai facade", async ({ page }) => {
  await page.goto("/opeaiapi");
  await expect(page.locator("#mode-status")).toContainText("Ore no OpenAI API");
});

test("oprenaiapi root path maps to openai facade", async ({ page }) => {
  await page.goto("/oprenaiapi");
  await expect(page.locator("#mode-status")).toContainText("Ore no OpenAI API");
});

test("opeaiapi alias path maps to openai facade", async ({ page }) => {
  await page.goto("/opeaiapi/");
  await expect(page.locator("#mode-status")).toContainText("Ore no OpenAI API");
});

test("oprenaiapi alias path maps to openai facade", async ({ page }) => {
  await page.goto("/oprenaiapi/");
  await expect(page.locator("#mode-status")).toContainText("Ore no OpenAI API");
});

test("single-window lock blocks a second active OREO REMCP window", async ({ page }) => {
  const pageA = page;
  const pageB = await page.context().newPage();

  await pageA.goto("/");
  await pageA.locator("#operator-account").fill("nozomidevbusin@gmail.com");
  await expect(pageA.locator("#workspace-status")).toContainText("this window is owner");
  await expect(pageA.locator("#run-intent")).toBeEnabled();

  await pageB.goto("/");
  await pageB.locator("#operator-account").fill("nozomidevbusin@gmail.com");
  await expect(pageB.locator("#workspace-status")).toContainText("another active window");
  await expect(pageB.locator("#run-intent")).toBeDisabled();
  await expect(pageB.locator("#policy-box")).toContainText("standby");

  await pageB.close();
});

test("guard blocks unknown operator account", async ({ page }) => {
  await page.goto("/");
  await page.locator("#operator-account").fill("other@example.com");
  await page.locator("#goal-input").fill("Start operation now.");
  await expect(page.locator("#run-intent")).toBeDisabled();
  await expect(page.locator("#workspace-status")).toContainText("Workspace guard blocked");
  await expect(page.locator("#policy-box")).toContainText("standby");
  await expect(page.locator("#trace-list li")).toHaveCount(0);
  await expect(page.locator("#guard-toggle")).toBeChecked();
  await expect(page.locator("#guard-toggle")).toBeDisabled();
});
