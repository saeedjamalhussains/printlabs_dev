# ThePrintLabs

An online poster shop with a storefront, an admin dashboard, an Express + MongoDB API, and Fabi, a Python shopping assistant.

## Repository layout

```text
printlabs_dev/
├── apps/
│   ├── store/          Customer website (React + Vite)
│   ├── admin/          Admin dashboard (React + Vite)
│   ├── server/         Express + MongoDB API
│   └── assistant/      Fabi, the Python service
├── shared/
│   ├── packages/
│   │   ├── categories/ Shared category parsing and normalization
│   │   ├── guards/     Shared payment-topic guardrail
│   │   └── ui/         Shared UI package for the storefront and admin
│   ├── config/         Shared config defaults
│   ├── scripts/        Repo-wide helper scripts
│   ├── assets/         Brand images and shared assets
│   └── README.md       Shared-folder overview
├── package.json        Root workspace config and shared scripts
├── README.md           Local setup and repo conventions
├── LICENSE             Project license
└── .gitignore          Ignore local env files and generated output
```

The storefront and admin call the API. The API owns MongoDB and product logic. The API also calls Fabi for product recommendations; if Fabi is unavailable it falls back to a server-side product keyword search.

## Shared packages

- `@printlabs/categories` — shared category parsing and normalization used by the API and admin app.
- `@printlabs/guards` — the single payment-topic guard used by both the storefront and the assistant.
- `@printlabs/ui` — reusable UI primitives shared by the storefront and admin dashboard.

## Run locally

Install Node.js 20.19+, npm, and MongoDB 7. The optional assistant also needs Python 3.12+.

From the repo root:

```sh
npm install
cp apps/server/.env.example apps/server/.env
cp apps/store/.env.example apps/store/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/assistant/.env.example apps/assistant/.env
```

Fill in the environment files before starting the stack:

- `apps/server/.env` — MongoDB URI, JWT secret, Cloudinary credentials, Razorpay credentials, and the assistant’s shared internal key.
- `apps/store/.env` — public storefront config such as the API URL and any non-secret client values.
- `apps/admin/.env` — admin-only public config such as the API URL.
- `apps/assistant/.env` — model and internal keys for Fabi.

Start MongoDB, then run:

```sh
npm run dev
```

| Application | Address |
|---|---|
| Store | http://localhost:5173 |
| Admin | http://localhost:5174 |
| API | http://localhost:5001 |
| Assistant | http://localhost:8100 |

Create your first admin account with `npm run create-admin`, then add products through the admin app.

### Run Fabi

In a separate terminal:

```sh
cd apps/assistant
cp .env.example .env
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8100
```

Before starting, set `OPENROUTER_API_KEY` and use the same `INTERNAL_API_KEY` as the API.

## Commands

Run these from the repo root:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the API, storefront, and admin dashboard |
| `npm run dev:server` | Start just the API |
| `npm run dev:store` | Start just the storefront |
| `npm run dev:admin` | Start just the admin dashboard |
| `npm run build` | Build all apps that define a build step |
| `npm run lint` | Run workspace lint checks |
| `npm test` | Run the workspace test suites |
| `npm run create-admin` | Create the first admin user |
| `npm run audit:log` | Read the service audit log |
| `npm run test:security` | Run the Cloudinary security checks |

## Notes

- Keep all local secrets in `.env` files only; never commit them.
- Never put a secret in a `VITE_*` variable. Those are bundled into browser code.
- Restart the API after editing `apps/server/.env`.
- The repo runs directly on localhost; no Docker, Compose, or cloud-specific stack is required.
- The server’s image upload preset logic lives in `apps/server/features/images/uploadPresets.js` and is intentionally separate from the client-side `imageQuality` helper in the storefront.
