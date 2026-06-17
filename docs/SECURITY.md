# Bacta — Security & Data Protection

Bacta holds a single user's complete biometric history plus AI API keys. The home
LAN is **not** treated as a trust boundary (other devices, IoT, guests, a
compromised laptop all share it). This documents what is implemented in the app
and what remains a host/network runbook for the operator to execute.

> Status as of v1.0 (2026-06-17). App-level controls are built and shipped on the
> `e2e-release-sweep` branch. Infrastructure items below marked **RUNBOOK** are
> the operator's manual follow-up and are **not** performed by the app.

---

## 1. Threat model

- **Primary asset:** `data/bacta.db` — 13+ months of PHI — and the plaintext AI/research API keys in `app_settings`.
- **In scope (app):** anyone on the LAN reaching `bacta.local`; a prompt-injection payload arriving via MX-4's wiki, the external vault, or research results; malformed/hostile API input; the LLM emitting destructive SQL.
- **Out of scope for the app, in scope for the runbook:** network reachability off-LAN, disk theft (encryption at rest), OS/host compromise, the NFS vault transport, the CI runner.

## 2. Implemented (app-level, shipped in v1.0)

| Control | Where | Notes |
|---|---|---|
| **App authentication** | `server/lib/auth.ts`, `server/api/auth.ts`, `requireAuth` in `server/index.ts` | Numeric PIN (4–12 digits) hashed with scrypt; stateless HMAC-signed session token in an httpOnly, SameSite=Lax cookie. Enforced on all data/AI/settings routes once a PIN is set. Health + auth endpoints exempt. **Set a PIN on first run** (Settings → SECURITY) — until then the app logs a loud warning and stays open. |
| **Login brute-force throttle** | `server/index.ts` (`loginLimiter`) | 10 attempts / 15 min on `/login` + `/set-pin`. |
| **`queryDb` read-only** | `server/lib/ai/tools.ts`, `dbReadonly` in `server/db/client.ts` | The LLM's SQL runs on an engine-level read-only connection + `stmt.reader` guard + SELECT/WITH-only check; `prepare()` blocks multi-statements. Writes/DDL/CTE-smuggled writes are refused. |
| **Prompt-injection defense** | `server/lib/ai/prompt.ts`, `mx4/HEARTBEAT.md` | Retrieved wiki/vault/research content is delimited and framed as untrusted DATA; a standing order forbids following directives inside retrieved content or letting it drive write tools. Verified end-to-end (a planted "overwrite your profile" injection was ignored). |
| **Security headers / CSP** | `helmet()` in `server/index.ts` | CSP locks script/connect to `'self'`; style/font allow Google Fonts; `frame-ancestors 'none'`; `x-powered-by` off. |
| **Input validation** | `server/api/settings.ts` | `PUT /settings/:key` whitelists known keys + per-key value validation; `auth_*` keys are never settable or exposed. Other routes validate bodies. |
| **Rate limiting + body cap** | `server/index.ts` | `express.json({limit:'1mb'})`; 40 req / 5 min on `/api/mx4` + `/api/poll`. |
| **No error leakage** | route handlers + global error middleware | Generic client errors; stack/SQL/paths logged server-side only. The `queryDb` tool returns a generic failure to the model (no schema leak). |
| **Secret masking** | `server/api/settings.ts`, `SECRET_SETTING_KEYS` | `ai_api_key`, `research_api_key` masked on GET; never logged; never sent to client. |
| **XSS-safe rendering** | client | ReactMarkdown (no `rehype-raw`) strips raw HTML; no `dangerouslySetInnerHTML` anywhere. |
| **Parameterized SQL** | all server queries | better-sqlite3 bound params throughout; no string-concatenated SQL. |
| **File permissions** | sweep + backup script | `data/bacta.db*` and `backups/*.gz` are `600`; `~/.garminconnect` is `700`/`600`. |
| **PHI out of git** | `.gitignore` + `git rm --cached` | `mx4/wiki/` and `mx4/HEARTBEAT.md` untracked; `data/`, `backups/`, `*.bak-*` ignored. **History scrub is a runbook step — see §4.** |

## 3. Conscious accepted risks (single-user LAN, v1.0)

- **Plaintext HTTP on the LAN.** API keys and PHI travel unencrypted between device and server. Mitigation until TLS: use Tailscale (encrypted) for any non-local access; the session cookie is httpOnly but not `Secure` (would break over HTTP). See §4 TLS.
- **API keys at rest in SQLite plaintext.** Covered on disk only once encryption-at-rest (§4) lands. Masked on GET, never logged. Backups inherit this — keep them `600` and encrypt off-box copies.

## 4. RUNBOOK — operator follow-up (not performed by the app)

These touch the container/host/network and must be run manually. None take the app offline except where noted.

### 4.1 PHI git-history scrub (do this before any push to a shared remote)
`mx4/wiki/` and `mx4/HEARTBEAT.md` were committed in history. They are now untracked, but history still contains them.
```bash
# from a fresh clone/mirror; coordinate — this rewrites history and needs a force-push
pip install git-filter-repo
git filter-repo --path mx4/wiki --path mx4/HEARTBEAT.md --invert-paths
git push --force --all && git push --force --tags
# treat any previously-pushed content as compromised; rotate exposed secrets.
```

### 4.2 Network access control (Tailscale is already running — leverage it)
```bash
# ufw: allow the app port only from the LAN subnet + Tailscale interface
sudo ufw default deny incoming
sudo ufw allow from 192.168.1.0/24 to any port 3001 proto tcp
sudo ufw allow in on tailscale0 to any port 3001 proto tcp
sudo ufw enable
```
Scope Tailscale ACLs so only your devices can reach the Bacta node. This also provides the encrypted path that mitigates plaintext HTTP.

### 4.3 Encryption at rest
LUKS full-disk on the LXC 109 volume is the recommended default (covers DB, tokens, backups). SQLCipher for `bacta.db` is an app-level alternative but LUKS is simpler and complete.

### 4.4 TLS on the LAN
Terminate TLS via a local reverse proxy (Caddy/nginx) with an internal CA or Tailscale's HTTPS; then set the session cookie `Secure`. Until then Tailscale is the encrypted path.

### 4.5 systemd hardening (`bacta-api.service`)
Add: `NoNewPrivileges=true`, `ProtectSystem=strict`, `ProtectHome=read-only`, `PrivateTmp=true`, `ReadWritePaths=/opt/bacta/data /opt/bacta/backups /opt/bacta/mx4`, drop capabilities. Confirm the service runs as `wheat` (non-root).

### 4.6 OS patching
Enable `unattended-upgrades`; keep installed services minimal.

### 4.7 NFS + vault-MCP lockdown
Restrict the LXC 106 NFS export to LXC 109's IP, read-only. The vault MCP SSE (`192.168.1.202:8765`) is currently open on the LAN — add an IP allowlist or auth so only Bacta can query the second brain.

### 4.8 Self-hosted runner hardening
The Actions runner on LXC 109 has repo + deploy access. Confirm it does not auto-build untrusted/fork PRs, its token is least-scope, and Actions secrets are never echoed to logs.

## 5. Dependency posture

`npm audit --omit=dev` → **0** vulnerabilities (shipping deps). Three **dev-only** highs exist in the build toolchain (vite/esbuild/form-data, Windows-specific advisories) — not shipped to the Linux production server; revisit on the next vite major.
