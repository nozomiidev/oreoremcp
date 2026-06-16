import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";

const ADMIN_OPERATOR = "admin-operator@local.test";
const ADMIN_SESSION_KEY = "oreoremcp.adminSession";
const ADMIN_PRIVATE_KEY = `{"alg":"RSA-OAEP-256","d":"Gh1YfuY7RnDIKn_C-u2UHTipYPQUNV35_FHrgNxoUF_MgW7mcq78E__Y8kGeO8owvKN4EtDFf_nvWGHXmSCF8CFDJOH0dKQP1R-TEw8v-eCDf7SCV0mkcZ-VMOHdeGre6GgKG6mjdDD6xmXlPdz3XSZq6pH4dHxa-bxdHVMaLlE0xk-I6khNiJvWahXo7T01D4Z6Z5oqYJ0sX7n8qXcSl1RRmV0Raquo1J-ryfgCWho6R_dau2QD0ddU0HkCv6uOO2lu3w_DPWp5ufryXe3XLGH7KUm981XuBwkQC6PkcqGSTyfkADx4X67o5LTigtOe6vIRDZbJCU8Zb1or5w-CKiWAQKuWp2BoayCSHaGBx4B5xJEVZUy3qLPqQ72aEn1-jBUqrS_4XNHU0v22GORWcRklt7giBPxnKTMRpWOlJEezCXqViVNZ5RXPz8ckXXVlxOPX_XBtFP4tWSNVg_pjOXr2VnVpC0SxpREh-l3ps-wdI7fLFMtIpyGl2F22B12FkMqdSCuz3_j7I37va9pxPUFlEzU_Sg99iOOXkFHa7PQ0VEv1_yMNpN3cbLKNK84mXx8mD8iTS2qPPWiPixvJwG7mV5QJh7VpKF_7OiGN6-oyyl7gmqwyb_bd3qdOAL-5hhTfotqKTGt6NDNz4ZK_bWMJcUKK9u5MAZeOlTVAD4E","dp":"RSSi1uwzNyhlF8J0pmmiesvRGkXna7rgXoAyDRmYEO6dpBSj5CJNINFdwVPSaQbLjCda2gUs21P0N0ihpFAotOCiQlpo27aP-hknk1zSkdDdikvgT9-vICGr_kqGqAUFM4W5uRJWqaDqgo3GHVyceSQTlGVaAzN9Eo16vzfI3aBZ-ScRU6wnOQSmnp_ezNw7uusbtnH6ERBX61xs4na562sM7U3UFVw74sNesjSBH95TosKw7aIEhhENb8s-BcPfWFazZPTskaMlCZIap91RphmoOMWh_DYOJ0UnnyBN4q0oXg_JEMSKEU11gpr7l_7zW9Fp6resqwuFqNnfdzctUQ","dq":"tiZhWH2XHmRw-QGJ9xKQbdI4F0Lp5yCLzLj5CNgyaLAtEZx9QShWqYN-w4ejcgGyrd7LjrVUXuqgCrZ7cQ6SuurhgzgBtNGsXGixtfnwWlHyblmzmD8AgHmg9uCXzSzfYtfv3FiO2MFjARcG4g63MSjF_DR58PNk9lUJEFV9NLklh2i_QTkjbfGf8_ZOAF4y3iAC9cD61qvUQmS7tvErEmxfxrFaYNbsWU20gUP3uUCFubIcRcKabQfQ1zuH-K3mMk8wXH7zjF2cIvi8-NjlF1V0mqdfUSXeGJZwAj7DIcr3iOXZNzcsgqjL4kSGTN7YEALNetYCKCw2y6YPfq5rMQ","e":"AQAB","ext":true,"key_ops":["decrypt"],"kty":"RSA","n":"zG2r-pRPKB7Httrcu-OYHrliBYxzQzdjRAC6fT7IP9m-O8rpqk2CHAHdFT0MhNgkac58N45CUPQdbQRHxBIS2yjUhbicRbvi7QX_1f5hZK2afMJLdeihTsUhpnA7g38P4OaDeg9iZSppK3EBddq7con4cmOnpKhJFaEM5Pm_N8F4doe-QF-kicQJehPoH3_jCMraZDD8SxYL5E6opvLKvsYssgvTtwMqNNq1EpXXs5KKxPkcVo8U2ZFjbx2TaEfbB7II0lXvCNvkP77RbPyb5OHGXlSd8DfQ8HBBNstJOFNS0-mXTe1tWh9UYkVzFlN4bxb-pN9M7_sw__zrXer_73AxbFV0Czt95LHqHqF-4bdNMflOuUM50M5x2X0DvizUtqVoEnazIoa9dP1hu0tVGVaJzl5Cbt_YH36JXyCKRyPR1e-g1xKA33JLk0XATUsxsGETK6vJtKHwLyzzJWjGY_ghNOYRxPtJXIna_pMfUR9ufYGg5QcJNTT319BwZqljd9MylvyhnW4y3VwIVcwQbVS_Hw2bB63PkmKe063SssPLmqWF7if7Guy8zDn9A2RplFq97kOrxDNPuHD1q_DofDGsLTTO5PRdfiWe11FGUGq00-c0pjQZhs5JiRbS2Ml93-e_bINGgH-4HOlObB9cjl3ZLmL4sPUeRdwCYON5828","p":"-6Jm-UbEy7yew_ITAToDeYzZiHVj_U2eyGU5nwrgpa6ND2K2_4T3D1TvF8qZ8R5uIT_mi24SblOyXs2-55MBxwqtlxicWSdm7rrDj7M0aK2J4eHmPLr0DldJlLvyncq8dCg4ZEBdp2aG7gj-c9AlnJw2790tRXOqG6wH6fkQVwTFVo-sONPqPOYtw9EblthuasX6ymbREum5M1pNi9J1K2aWPRxWemAA5UN2A69NDjVGL2aFSvz1xAgCvdIF7ZpmhzGjXULHkiKq_8KluoMmJbDSbg61wygQyynzGJBkH1F40vdYJX71u97jdJPR3nyUOddd_1cbOC8X1Mbp1rKdvw","q":"z_mca7swcvD9Pubatmz0rYGROprCMF3Hv0MQZgzr-VtxRRaIB1bgLVvmUueIQ9nKKnBoUT9ZrbDG1Ueo3gKl9qr9XVUbBJhyxjLTqDm5D22yfsxyT0015Zjq9JpK5DQqsJ9JsahJL4gGU5AW4DGi9GrN8NaJNIN9VFfcBdPFwx0RJrWrAoxlIYxlaOn2gxkuqFertrZ_S8YoaJ5N02CJdKPe2VvrzAmssm1k68IU57CJMyIdTTqcG4mDzWhGoS8h_-PlYZqtgAwrTOPVtVbAV-Qv5qYylnWNs3EfMR8bFEVr5n6zTlU2MVw7HiERrBzDJaIIxpM6su_qxQ5O78B2UQ","qi":"PHBkaHioI1YXf7SWnBRUyEHDEQly_Ldh5t2YQjhuoTcrN_59Gj7Eyf10vs2rX3fdEFyCA4ZXDWFbUSgPIZ5KFPvMsVfxjRIBrxD0aItjepFpV_rdP62KqF5AK1LlqtGhSbghvSyXrvZiHvV02rqpzGG7ZLnyXUs6_YdUP0gLNNZpi7dBO1KODZKM9NyO2C9RpaZwgAajqXz9Q8Gmci3Fnf3JCuUwsZzBhnK0OjDJfpfYiXhoRY82OMioHQmuYGahTgbm8qOlH9koIkOLJWoFAYOxfnwcUC7eQapPchMg5VzKLefYZ_Zgh32rt7zpI37_6NzWhIO8cbKNMJqXRX9-wg"}`;
const ADMIN_PRIVATE_KEY_GITHUB = ADMIN_PRIVATE_KEY.replace("\"alg\":\"RSA-OAEP-256\"", "\"alg\":\"@github\"");

function operatorFingerprint(value) {
  return createHash("sha256").update(String(value || "").trim().toLowerCase()).digest("hex");
}

async function clearLocalStorageState(page) {
  await page.evaluate(() => {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.removeItem("oreoremcp.adminSession");
      localStorage.removeItem("oreoremcp.workspaceLease");
      localStorage.removeItem("oreoremcp.traceLog");
      localStorage.removeItem("oreoremcp.operator");
    } catch {
      // In non-persistent or restricted contexts (like about:blank),
      // clear is intentionally best-effort only.
    }
  });
}

async function gotoWithAdminSession(page, path = "/") {
  await page.goto(path);
  await clearLocalStorageState(page);
  await page.evaluate(
    ({ key, operatorFingerprint: fp }) => {
      const now = Date.now();
      localStorage.setItem(
        key,
        JSON.stringify({
          v: 1,
          operatorFingerprint: fp,
          unlockedAt: now,
          expiresAt: now + 45 * 60 * 1000,
          proofNonce: "e2e-bypass"
        })
      );
    },
    { key: ADMIN_SESSION_KEY, operatorFingerprint: operatorFingerprint(ADMIN_OPERATOR) }
  );
  await page.reload();
  await page.locator("#operator-account").fill(ADMIN_OPERATOR);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await clearLocalStorageState(page);
});

test("landing and cockpit are usable from browser", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await page.locator("#enter-playground").click();
  await expect(page.locator("#playground")).toBeInViewport();
});

test("run intent shaping requires active admin session", async ({ page }) => {
  await clearLocalStorageState(page);
  await page.goto("/");
  await page.locator("#operator-account").fill(ADMIN_OPERATOR);
  await expect(page.locator("#run-intent")).toBeDisabled();
  await page.locator("#goal-input").fill("Sanity check before unlock.");
  await expect(page.locator("#workspace-status")).toContainText("admin session is not active");
  await expect(page.locator("#trace-list li")).toHaveCount(0);
  await expect(page.locator("#policy-box")).toContainText('"status": "standby"');
});

test("schema panels and intent execution flow", async ({ page }) => {
  await gotoWithAdminSession(page);
  await page.locator("#persona").selectOption("mcp-server");
  await page.locator("#goal-input").fill("Prepare safe deployment check steps.");
  await page.locator("#run-intent").click();

  await expect(page.locator("#policy-box")).toContainText('"allowedMode"');
  await expect(page.locator("#envelope-box")).toContainText('"/mcp/server"');
  await expect(page.locator("#response-box")).toContainText("MCP Server");
  await expect(page.locator("#trace-list li")).toHaveCount(1);
});

test("surface pills route to the matching public mode", async ({ page }) => {
  await gotoWithAdminSession(page);
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
  await gotoWithAdminSession(page);
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

  await gotoWithAdminSession(pageA);
  await expect(pageA.locator("#workspace-status")).toContainText("this window is owner");
  await expect(pageA.locator("#run-intent")).toBeEnabled();

  await gotoWithAdminSession(pageB);
  await expect(pageB.locator("#workspace-status")).toContainText("another active window");
  await expect(pageB.locator("#run-intent")).toBeDisabled();
  await expect(pageB.locator("#policy-box")).toContainText("standby");

  await pageB.close();
});

test("guard blocks session owner mismatch", async ({ page }) => {
  await gotoWithAdminSession(page);
  await page.locator("#operator-account").fill("other@example.com");
  await page.locator("#goal-input").fill("Start operation now.");
  await expect(page.locator("#run-intent")).toBeDisabled();
  await expect(page.locator("#workspace-status")).toContainText("admin session owner mismatch");
  await expect(page.locator("#policy-box")).toContainText("standby");
  await expect(page.locator("#trace-list li")).toHaveCount(0);
  await expect(page.locator("#guard-toggle")).toBeChecked();
  await expect(page.locator("#guard-toggle")).toBeDisabled();
});

test("admin unlock requires valid passphrase and private key", async ({ page }) => {
  await clearLocalStorageState(page);
  await page.goto("/");
  await page.locator("#operator-account").fill(ADMIN_OPERATOR);
  await page.locator("#admin-passphrase").fill("1234");
  await page.locator("#admin-private-key").fill(ADMIN_PRIVATE_KEY_GITHUB);
  await page.locator("#admin-unlock").click();
  await expect(page.locator("#admin-status")).toContainText("Admin unlock failed");
});

test("admin unlock succeeds with provided private key", async ({ page }) => {
  await clearLocalStorageState(page);
  await page.goto("/");
  await page.locator("#operator-account").fill(ADMIN_OPERATOR);
  await page.locator("#admin-passphrase").fill("oreoremcp-admin");
  await page.locator("#admin-private-key").fill(ADMIN_PRIVATE_KEY);
  await page.locator("#admin-unlock").click();
  await expect(page.locator("#admin-status")).toContainText("Admin session unlocked");
  await expect(page.locator("#workspace-status")).toContainText("Session expires in");
});

test("admin unlock accepts @github private key format", async ({ page }) => {
  await clearLocalStorageState(page);
  await page.goto("/");
  await page.locator("#operator-account").fill(ADMIN_OPERATOR);
  await page.locator("#admin-passphrase").fill("oreoremcp-admin");
  await page.locator("#admin-private-key").fill(ADMIN_PRIVATE_KEY_GITHUB);
  await page.locator("#admin-unlock").click();
  await expect(page.locator("#admin-status")).toContainText("Admin session unlocked");
  await expect(page.locator("#run-intent")).toBeEnabled();
  await page.locator("#goal-input").fill("Validate self-check scenario after unlock.");
  await page.locator("#run-intent").click();
  await expect(page.locator("#policy-box")).toContainText('"allowedMode": "openai-api"');
  await expect(page.locator("#envelope-box")).toContainText('"/api/openai/v1/chat/completions"');
});

test("tutorial and quick check are visible to users", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#tutorial")).toBeVisible();
  await expect(page.locator("#tutorial")).toContainText("For a quick operation check");
  await expect(page.locator("#tutorial")).toContainText("must succeed.");
});
});
