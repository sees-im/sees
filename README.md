<div align="center">

<img src="public/hero-preview.png" alt="SEES — Secure End-to-End State" width="100%">

<br><br>

[![License: MIT](https://img.shields.io/badge/license-MIT-f8f5ee?style=flat-square)](LICENSE)
[![Live](https://img.shields.io/badge/live-sees.im-ff6b17?style=flat-square)](https://www.sees.im)
[![Built with TanStack Start](https://img.shields.io/badge/built%20with-TanStack%20Start-030303?style=flat-square)](https://tanstack.com/start)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/sees-im/sees/badge)](https://scorecard.dev/viewer/?uri=github.com/sees-im/sees)

**Zero-knowledge encrypted notes. Your passphrase never leaves your device.**

[Live app](https://www.sees.im) · [Security model](https://www.sees.im/security) · [FAQ](https://www.sees.im/faq)

</div>

---

## What this is

SEES is a vault for notes and files where the server only ever stores ciphertext. There's no account, no email, and no recovery key — the encryption key is derived locally from a passphrase and never transmitted.

- **PBKDF2-SHA256, 250,000 iterations** derives an AES-256 key in-browser from a Vault ID + passphrase
- **AES-256-GCM** seals every note before it touches storage, giving confidentiality and tamper detection
- **Fragment-based sharing** — a share link's decryption key lives in the URL fragment, the part of a URL browsers never send to a server
- No plaintext backup, no server-side recovery path, no ability for the operator to read vault contents

Full write-up of the threat model: [sees.im/security](https://www.sees.im/security).

## Stack

| | |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (React, file-based routing, server functions) |
| Storage | S3-compatible object storage ([Storj](https://www.storj.io/)) |
| Hosting | [Vercel](https://vercel.com/) |
| Payments | [NearPayments](https://nearpayments.io/) (optional, for contributions) |

## Getting started

```bash
bun install
cp .env.example .env   # fill in the variables you need
bun run dev
```

Storj credentials are required for the app to read/write vaults. NearPayments and admin-panel variables are optional — the app runs without them.

```bash
bun run build   # production build
bun run lint    # eslint
```

## Project layout

```
src/
  routes/       file-based routes — pages and API routes
  components/   UI components
  lib/          server logic, crypto helpers, third-party integrations
public/         static assets
```

Any file suffixed `.server.ts` runs server-side only. Those are the sole places environment variables are read — nothing sensitive reaches the client bundle.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).

