---
name: vercel
description: >-
  Guides Vercel deployment workflows, serverless and edge runtime configuration, vercel.json
  routing/rewrites, environment variable management, and production performance optimization.
  Use when configuring Vercel deployment, setting up preview environments, or debugging Vercel builds.
---

# Vercel Deployment & Runtime Skill

Provides comprehensive procedures for configuring, building, and deploying applications onto the Vercel platform with high availability, security headers, and optimal serverless/edge performance.

---

## 1. Project Configuration (`vercel.json`)

Use `vercel.json` at the project root to control build settings, routes, headers, and function timeouts:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/((?!api/.*).*)", "destination": "/index.html" }
  ]
}
```

---

## 2. Environment Variables & Secrets Management

1. **Hierarchy**:
   - `Development`: Local values in `.env.local` (never committed).
   - `Preview`: Isolated staging database/keys for pull request previews.
   - `Production`: Live database connections, production Arcjet keys, and credentials.
2. **Arcjet on Vercel**:
   - Ensure `ARCJET_KEY` is added to Vercel Environment Variables across Preview and Production.
   - Set `NODE_ENV=production` in production environments so Arcjet executes in `LIVE` blocking mode.

---

## 3. Serverless & API Route Guidelines

- **Cold Start Optimization**: Keep top-level imports lean. Lazy-load heavy dependencies that are only used in conditional execution branches.
- **Connection Pooling**: When connecting to PostgreSQL via Drizzle ORM on serverless functions, use connection pooling (e.g. Supabase connection pooler, Neon serverless driver, or PgBouncer) to prevent database connection exhaustion.
- **Function Timeouts**: Standard hobby plans cap function execution at 10-15s, while Pro plans allow up to 300s. Configure `maxDuration` in function config if long-running batches are needed.

---

## 4. Build & Preview Troubleshooting Checklist

1. **Verify Local Production Build**:
   ```bash
   npm run build
   ```
2. **Check Output Directory**:
   - Confirm that the build output folder matches `outputDirectory` in `vercel.json` (e.g., `dist`).
3. **Inspect Serverless Bundling**:
   - Ensure native node modules are either bundled or listed as external dependencies.
