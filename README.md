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
│   │   ├── schemas/    Zod API contracts and generated JSON Schema
│   │   └── ui/         Shared UI package for the storefront and admin
│   ├── config/         Shared config defaults
│   ├── scripts/        Repo-wide helper scripts
│   ├── assets/         Brand images and shared assets
├── package.json        Root workspace config and shared scripts
├── turbo.json          Workspace task graph
├── README.md           Local setup and repo conventions
├── LICENSE             Project license
└── .gitignore          Ignore local env files and generated output
```

The storefront and admin call the API. The API owns MongoDB and product logic. The API also calls Fabi for product recommendations; if Fabi is unavailable it falls back to a server-side product keyword search.

## Shared packages

- `@printlabs/categories` — shared category parsing and normalization used by the API and admin app.
- `@printlabs/guards` — the single payment-topic guard used by the storefront and API.
- `@printlabs/schemas` — API request/response contracts; JSON Schema is generated from Zod for Python validation.
- `@printlabs/ui` — reusable UI primitives shared by the storefront and admin dashboard.

## Feature map

Server models, routes, controllers, and feature-specific services live together under `apps/server/features/<feature>/`. Auth owns `userService.js`; products owns `categoryQuery.js`; image upload/signing and Cloudinary admin actions live in `features/images/`; audit writing, viewing, and routes live in `features/audit/`. Keep `apps/server/utils/` for generic helpers only.

The product contract source is `shared/packages/schemas/src/product.js`. Regenerate `shared/packages/schemas/json/product.schema.json` with `npm run generate:schemas`; Python tests validate API product data against that generated file. Do not edit generated JSON by hand.

## Run locally

Install Node.js 20.19+, npm, MongoDB 7 at `127.0.0.1:27017`, and Python 3.12+.

From the repo root:

```sh
npm install
npm run setup
```

The setup command copies `.env.example` files only when the corresponding `.env` does not exist, so local configuration is never overwritten.

Fill in the environment files before starting the stack:

- `apps/server/.env` — MongoDB URI, JWT secret, Cloudinary credentials, Razorpay credentials, and the assistant’s shared internal key.
- `apps/store/.env` — public storefront config such as the API URL and any non-secret client values.
- `apps/admin/.env` — admin-only public config such as the API URL.
- `apps/assistant/.env` — model and internal keys for Fabi.

Generate a 32-character-or-longer random value for `JWT_SECRET` and `INTERNAL_API_KEY`. Use the same internal key in `apps/server/.env` and `apps/assistant/.env`. Set `OPENROUTER_API_KEY` in the assistant env file. The example credentials are placeholders and will stop startup until replaced.

Create Fabi's Python environment before starting the root stack:

```sh
python3 -m venv apps/assistant/.venv
apps/assistant/.venv/bin/pip install -r apps/assistant/requirements.txt
```

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
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8100
```

Before starting, set `OPENROUTER_API_KEY` and use the same `INTERNAL_API_KEY` as the API.

## Commands

Run these from the repo root:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the API, storefront, admin dashboard, and Fabi |
| `npm run dev:server` | Start just the API |
| `npm run dev:store` | Start just the storefront |
| `npm run dev:admin` | Start just the admin dashboard |
| `npm run build` | Build all apps that define a build step |
| `npm run lint` | Run workspace lint checks |
| `npm test` | Run the workspace test suites |
| `npm run setup` | Copy missing app `.env` files without overwriting existing ones |
| `cd apps/assistant && python3 -m unittest discover -s tests` | Check Fabi's generated JSON Schema contracts and startup credential validation |
| `npm run create-admin` | Create the first admin user |
| `npm run audit:log` | Read the service audit log |
| `npm run test:security` | Run the Cloudinary security checks |
| `npm run generate:schemas` | Regenerate JSON Schema from the Zod contracts |

## Notes

- Keep all local secrets in `.env` files only; never commit them.
- Never put a secret in a `VITE_*` variable. Those are bundled into browser code.
- Restart the API after editing `apps/server/.env`.
- The repo runs directly on localhost; no Docker, Compose, or cloud-specific stack is required.
- The server’s image upload preset logic lives in `apps/server/features/images/uploadPresets.js` and is intentionally separate from the client-side `imageQuality` helper in the storefront.
