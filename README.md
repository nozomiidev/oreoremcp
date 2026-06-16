# OREO REMCP Portal

Human-first static service that presents:

- MCP Client (`/mcp/client`)
- MCP Server (`/mcp/server`)
- OpenAI-compatible facade (`/api/openai/v1/chat/completions`)

The page runs on GitHub Pages and works as a polished landing + protocol cockpit.

## What this delivers

- Product identity model:
  - `mcp-client`: inbound surface that normalizes and routes intent.
  - `mcp-server`: execution-facing surface where the human operator approves steps.
  - `openai-api`: external OpenAI-like contract (`/api/openai/v1/chat/completions`) that always routes through the cockpit.
- Clear separation of the three public surfaces.
- Intent shaping and filter pipeline before output.
- Account boundary guard uses an operator session created from the unlock flow.
- Visible protocol contracts for each surface.
- Debug/admin ergonomics:
  - audit log list
  - local persistence
  - JSON export
  - copy envelope payload
- Operator safety:
  - admin unlock requires private key + passphrase
  - admin-boundary is session owner-driven (operator identity is never hardcoded)
- Unit + e2e tests.

## Intent shaping and guard behavior

- Sanitization removes dangerous control text (`ignore previous instructions`, script tags, control chars, etc.).
- Boundary guard blocks operators when the active session owner and operator field do not match.
- Every request creates:
  - signed envelope (public surface contract)
  - policy object (risk signals + intent)
  - visible action plan
  - trace record (`traceId`) for audit.
- Public surface map is explicit and observable:
  - `POST /mcp/client`
  - `POST /mcp/server`
  - `POST /api/openai/v1/chat/completions`
- Route aliases preserved for typo-safe entry:
  - `POST /mcp/client/`
  - `POST /mcp/server/`
  - `POST /api/openai/v1/chat/completions/`
  - `POST /openaiapi/`
  - `POST /opeaiapi/`
  - `POST /oprenaiapi/`
  - `POST /openaiapi`
  - `POST /opeaiapi`
  - `POST /oprenaiapi`
- Route-style entry pages are provided as a first-class surface experience:
  - `/mcp/client/`
  - `/mcp/server/`
  - `/api/openai/v1/chat/completions/`

## Files

- [index.html](./index.html)
- [src/app.js](./src/app.js)
- [src/engine.js](./src/engine.js)
- [src/contracts.js](./src/contracts.js)
- [tests/unit/engine.test.js](./tests/unit/engine.test.js)
- [tests/e2e/portal.spec.js](./tests/e2e/portal.spec.js)

## Run locally

```bash
npm ci
npm run dev
```

## Test

```bash
npm run test:unit
npm run test:e2e
npm run test:ci
```

## GitHub Pages

- Build: `npm run build`
- Deploy workflow: [.github/workflows/pages.yml](./.github/workflows/pages.yml)

## Operational rule included

- Boundary guard is enforced by default and cannot be disabled from UI.
- If guard is enabled, different addresses are blocked in runtime.
  - In this build, the boundary guard is enforced by default and cannot be disabled from UI.
  - Keep all debug/admin operations and browser-based checks in the same execution context to avoid cross-session drift.
  - Do not execute this service tasks in another user session or Chrome profile during development.
- The workspace lock is enforced per-browser-profile at runtime:
  - when one OREO REMCP window owns the local operator lock, concurrent windows cannot execute `Run intent shaping`.
  - this is visible in UI via `#workspace-status` and blocks multi-window race conditions.

## Environment rule for this local workspace

- The workspace assumes the operator safety boundary is enforced at runtime by the session owner identity.
- For manual operator actions, use your dedicated browser profile/session and avoid mixing sessions while running.
- Keep development, testing, and admin operations within the same local user session to avoid cross-account drift.
- Do not use another browser profile window or another operator identity while creating test traces for this workspace.

## Security note

- No fixed operator email or private-key identity is embedded in runtime logic or source comments.
- Admin session unlock requires:
  - valid private key JWK JSON in decrypt-capable form (`"alg": "@github"`),
  - passphrase length of 8+ characters,
  - operator identity entered in the form field.

### Admin identity policy

- Do not hardcode any operator email (including dedicated accounts such as `nozomidevbusin`) in source code, HTML, scripts, or repository data.
- The operator identity is entered by the operator in runtime and is persisted only as an internal session hash.
- If you use a dedicated account on a fixed browser profile, treat it as an operational convention outside code (browser input only).

## Note

Local validation and CI run on Node.js 20+.
The workspace assumes the operator safety boundary is enforced at runtime by the session owner identity.

## Verification checklist (for this product level)

### 1) Surface separation validation

- Access:
  - `/{landing}`
  - `/mcp/client/`
  - `/mcp/server/`
  - `/api/openai/v1/chat/completions/`
  - `/openaiapi/`
  - `/opeaiapi/`
  - `/oprenaiapi/`
  - `/openaiapi`
  - `/opeaiapi`
  - `/oprenaiapi`
- Confirm each entry resolves to the intended mode.

### 2) Safety and governance validation

- Boundary account mode:
  - set operator to a stable local test identity (example: `your-operator@local.test`)
  - run a sample prompt and confirm policy summary and envelope are produced.
  - confirm `Admin session unlocked` requires both passphrase and valid private key.

### 2.5) User self-check (2 minutes)

- Without any unlock, press "Run intent shaping" and confirm:
  - status message indicates blocking by admin boundary.
- Enter short passphrase (7 chars) and valid key shape:
  - unlock must fail.
- Enter 8+ char passphrase with `@github` private key format:
  - unlock must succeed and `Run intent shaping` becomes enabled.
- After successful unlock, run one sample prompt and confirm:
  - `#policy-box`, `#envelope-box`, `#response-box` all update.
- Confirm landing page guidance is visible:
  - section `#user-self-check` and list `#quick-self-check` appear,
  - `#quick-check-blocked`, `#quick-check-short-pass`, `#quick-check-github-key`, `#quick-check-run-works` exist.

- Non-session-owner mode:
  - set operator to a different identity from the active session
  - confirm `Run intent shaping` is disabled and workspace status shows boundary block.
- Multi-window governance:
  - open `/` and fill boundary account in two tabs/windows on same browser profile.
  - confirm only one tab can run intents; others show lock block message.

### 3) CI gate validation

- Run: `npm run test:ci` (requires Node 20+)
- Ensure:
  - `unit: PASS`
  - `build: PASS`
  - `e2e: PASS`

### 4) GitHub Pages publication validation

- Push to `main` (or `master`) and confirm:
  - `pages` workflow completes
- Access published URL:
  - all three canonical surfaces are visible and routable
  - openai-like contract and MCP contract payload previews are shown
  - operator boundary and workspace lock messages appear for governance checks
