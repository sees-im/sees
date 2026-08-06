# Contributing

Thanks for considering a contribution to SEES.

## Reporting bugs

Open an issue with:

- What you expected to happen vs. what actually happened
- Steps to reproduce
- Browser/OS, if relevant

## Reporting security issues

Do **not** open a public issue for a security vulnerability. See [SECURITY.md](SECURITY.md) instead.

## Submitting changes

1. Fork the repo and create a branch off `main`
2. Keep changes focused — one concern per pull request
3. Run `bun run lint` and `bun run build` before opening the PR
4. Describe the change and the reasoning behind it in the PR description

## Development setup

```bash
bun install
cp .github/.env.example .env
bun run dev
```

See the [README](README.md) for the full stack overview and project layout.
