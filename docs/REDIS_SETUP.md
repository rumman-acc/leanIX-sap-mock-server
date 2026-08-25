# Redis Setup Needed From You

The mock server needs a Redis instance for:
- Sliding-window rate limiting (per-user 1800/min, per-workspace 1200/min)
- BullMQ background jobs (webhook dispatch/retry, sync run processing, trash-bin cleanup)

Docker isn't available in this dev environment, so instead of a local Redis container we're using a managed/cloud Redis. Any of these work — pick whichever is easiest for you:

- **Upstash** (https://upstash.com) — free tier, gives you a `rediss://` URL directly.
- **Redis Cloud** (https://redis.io/cloud) — free tier (30MB), gives you a `redis://` URL with host/port/password.
- Any other reachable Redis 7.x instance (self-hosted, another cloud provider, etc.)

## What to give me

Just the full connection string, e.g.:

```
rediss://default:<password>@<host>:<port>
```

or

```
redis://default:<password>@<host>:<port>
```

## What I'll do with it

Set it as `REDIS_URL` in `.env` (local dev) — it is **not** committed to git. Everything (rate limiter, BullMQ queues) reads this single env var, so nothing else needs to change once you paste it in.

Until you provide it, I'm continuing to build every other part of the system (Postgres/Prisma models, GraphQL, REST, LDIF processing, etc.) using the native PostgreSQL already running locally. Redis-dependent code is written against `ioredis`/`REDIS_URL` but won't be live-tested until the URL is available — see `docs/BUILD_STATUS.md` section 4 for current verification status.
