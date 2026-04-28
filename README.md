# MQS Lead Verifier

Apollo.io CSV → Claude AI classification → SDR working view.

## Setup

1. Copy env vars:
   ```
   cp .env.local.example .env.local
   ```
   Fill in `DATABASE_URL` (Neon Postgres) and `ANTHROPIC_API_KEY`.

2. Run the schema against your Neon database:
   ```
   psql $DATABASE_URL -f lib/schema.sql
   ```

3. Install and run:
   ```
   npm install
   npm run dev
   ```

## Deploy (Vercel)

Push to GitHub, connect repo in Vercel, add env vars in Vercel dashboard.

## Usage

1. Go to `/` — upload an Apollo CSV
2. Watch classification progress bar (batches of 10, 3 concurrent)
3. Use `/results` to filter by status/niche/industry, override classifications, and export CSV