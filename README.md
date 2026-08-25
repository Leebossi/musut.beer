# musut.beer

[![Deploy site and gateway to VPS](https://github.com/Leebossi/musut.beer/actions/workflows/deploy-vps.yml/badge.svg)](https://github.com/Leebossi/musut.beer/actions/workflows/deploy-vps.yml)

Vanilla static site with VPS-ready Nginx + Node auth gateway.

## Docker Development

This local stack mirrors the production flow:
- `nginx` serves `site/` and proxies `/api/*` + `/protected/*` to gateway
- `gateway` verifies passphrase and signs short-lived cookie tokens
- `protected-origin` serves mock protected files

The repo includes a ready-to-run `.env` for local development. Edit it if you want different defaults.

### Start

```bash
docker compose up --build
```

Open `http://localhost:8080` unless you changed `WEB_PORT`.

### Dev passphrase

Use `devpass`.

To allow a wordlist instead of a single hash, set `PASSPHRASE_WORDLIST` to a comma- or newline-delimited list such as:

```bash
PASSPHRASE_WORDLIST="alpha, beta, gamma"
```

Then any one of those words will unlock the site.

### Test endpoints

- Public page: `http://localhost:8080/`
- Protected resource after unlock: `http://localhost:8080/protected/library.json`

### Stop

```bash
docker compose down
```

## Production notes

- Keep `COOKIE_SECURE=true` in production.
- Use a strong random `TOKEN_SIGNING_KEY`.
- Prefer `PASSPHRASE_HASH` over plaintext passphrases.
- Set `PROTECTED_ORIGIN=http://127.0.0.1:8081` in production so the gateway fetches protected files from the internal nginx origin instead of recursively calling the public `/protected/*` route.
- Deploys now sync the `protected/` directory to `/var/www/musut.beer/shared/protected-origin` for that internal origin.
