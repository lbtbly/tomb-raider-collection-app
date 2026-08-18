# Scout C: free-tier platform limits

Raw scout return, checked 2026-08-17. Every number carries a source. Numbers decay;
recheck before deploy.

## 1. Vercel Hobby

Fast Data Transfer 100 GB/mo. Edge Requests 1M/mo. Function Invocations 1M/mo.
Active CPU 4 hrs/mo. Provisioned Memory 360 GB-hrs/mo. Image Transformations
5K/mo. Image Cache Reads 300K/mo. Cache Writes 100K/mo. No published build-minute
cap. https://vercel.com/pricing

**The commercial-use restriction is real and enforced by ToS.** Hobby is for
non-commercial, personal use. Vercel's definition of commercial is broad: any
project where a paid employee or consultant wrote the code, sites that process
payment, carry ads, run affiliate links, or solicit donations. A free, ad-free,
donation-free community catalogue is defensible on Hobby. Anything monetized,
including a donate button, forces Pro at $20/user/mo.

First limits a photo-heavy app hits: **Image Transformations (5K/mo)**, trivially
exceeded once users upload real photos and thumbnails get generated, then Fast
Data Transfer once a thumbnail grid is browsed by more than a handful of
concurrent users.

**Vercel Postgres no longer exists as a first-party product.** Migrated to Neon in
December 2024, now sold through the Marketplace as a Neon integration.
https://vercel.com/docs/postgres

## 2. Free Postgres

- **Neon Free**: 0.5 GB storage per project, 100 CU-hours compute/mo, scale-to-zero
  after 5 min idle (a pause, not a delete: compute suspends, data persists), 10
  branches per project, EU region available (Frankfurt). Exceeding limits suspends
  compute until the next billing month. Does not delete data. https://neon.com/pricing
- **Supabase Free**: 500 MB database, 1 GB file storage, 5 GB egress plus 5 GB
  cached egress, 50,000 MAU for Auth. **Free projects pause after 1 week of
  inactivity.** That is the killer for a low-traffic launch: a quiet week takes down
  the whole project, database, storage, and auth, until manually unpaused. EU region
  (Frankfurt, eu-central-1) selectable at project creation.
  https://supabase.com/pricing  https://supabase.com/docs/guides/platform/regions

Neon's pause-not-delete behaviour is materially safer than Supabase's weekly
project pause. 0.5 GB is tight but workable **if photos live in object storage,
never in the database**.

## 3. Free object storage for photos

- **Cloudflare R2**: 10 GB-month storage free, 1M Class A ops/mo, 10M Class B
  ops/mo, and **egress is free on R2 for everyone**, via Workers API, S3 API, and
  r2.dev domains. No built-in image transformation on free (Cloudflare Images is a
  separate paid product), so resizing happens client-side or in a Worker. EU Data
  Location is a paid add-on, not on free.
  https://developers.cloudflare.com/r2/pricing/
- **Vercel Blob**: free within Hobby's shared pool. Rate limits 1,200 simple
  ops/min, 900 advanced ops/min. Max blob 5 TB. Blobs over 512 MB never cache.
  Exceeding limits locks Blob access for 30 days without deleting data.
  https://vercel.com/docs/vercel-blob/usage-and-pricing
- **Cloudinary Free**: 25 monthly credits (about 25,000 transformations or 25 GB
  storage/bandwidth equivalent, fungible). Transformation is its strength. No EU
  residency guarantee on free. https://cloudinary.com/pricing
- **Uploadthing Free**: 2 GB storage across all apps on the account, unlimited
  uploads and downloads, no transformations. https://uploadthing.com/pricing

For a few hundred users uploading item photos, **R2 is the only one with
headroom**: 10 GB plus genuinely free egress beats Cloudinary's credit ceiling and
Uploadthing's 2 GB. The tradeoff is no free transform pipeline, so thumbnail at
upload time (client-side canvas resize, or a Worker).

## 4. Free auth

- **Supabase Auth**: 50,000 MAU, tied to the same weekly-inactivity-pause risk.
- **Clerk Hobby**: 50,000 Monthly Retained Users (users returning 24h+ after
  signup, not simple MAU), one-month grace past the cap before forced Pro. No EU
  data residency on free. https://clerk.com/pricing
- **Auth.js / NextAuth self-hosted**: no cap by definition, runs inside the app on
  Vercel's own function and DB budget. Inherits the Postgres free tier for sessions
  and users. Needs its own email provider for magic links.
- **WorkOS**: 1M MAU free for AuthKit. https://workos.com/pricing

At this scale every option clears the cap. The deciding factor is **coupling**.
Supabase Auth ties auth to the weekly-pause risk. Auth.js against Neon avoids that
and keeps everything on one Postgres.

## 5. Free email (magic links, notifications)

- **Resend Free**: 100/day, 3,000/month, 1 verified domain. https://resend.com/pricing
- **Postmark Free (Developer)**: 100 emails/month, permanent, meant for testing.
  https://www.postmarkapp.com/pricing
- **SendGrid**: replaced its permanent free tier with a **60-day trial** at 100/day.
  No longer a durable free option.
  https://www.twilio.com/en-us/products/email-api/pricing

Resend is the only durable production-usable free tier of the three.

## 6. Search

Postgres native full-text search (`tsvector`/`tsquery`, plus `pg_trgm` for fuzzy
and typo-tolerant matching on titles and variant names) is free on Neon and
realistic at a few thousand to tens of thousands of rows, sub-100ms on one small
compute instance. Dedicated search services are not viable free: Meilisearch Cloud
free is a 14-day trial, Algolia's free tier (10K records / 50K searches)
undershoots once variant rows count. **Build search on `pg_trgm` plus `tsvector`.
Skip the search service.**

## 7. The honest failure mode

Vercel Hobby + Neon Free + Cloudflare R2 + Auth.js + Resend Free stays free through
roughly a few hundred active users, a seeded catalogue of a few thousand items, and
low thousands of photo uploads.

**First hard wall: Neon's 0.5 GB storage cap.** A few thousand catalogue items plus
user collection rows, purchase metadata, and photo references will approach it
before traffic becomes the constraint. Neon suspends compute for the rest of the
billing month when 0.5 GB or 100 CU-hours is exceeded, which reads to users as the
whole app going down, not degrading gracefully.

**Second wall, on a launch spike (a Reddit or collector-forum feature): Vercel
Hobby's 100 GB Fast Data Transfer**, hit fast by photo-grid browsing since each
image view on a cache MISS counts.

Safest sequencing: DB storage discipline first. Photos in R2, never in Postgres.
Trim columns aggressively. That buys the most runway before any single number
forces a paid upgrade.
