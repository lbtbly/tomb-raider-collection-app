# Operator checklist

Six things need your consoles. I cannot create accounts, enter credentials, or accept
terms on your behalf, and I will never write a secret value into this repository.

Do these whenever suits. The build continues without them; they gate the live URL and
the three OPERATOR rubric lines, not the code.

Every value goes in through `vercel env add`, typed by you, never pasted to me.

---

## Do them in this order

The list is numbered by topic, not by sequence, and following it top to bottom
wastes a round trip: **3 and 4 need the Vercel URL, which does not exist until
after a first deploy**, and every `vercel env add` needs a linked project.

Checked just now: **the Vercel CLI is not on your PATH and this repo is not
linked to a project.** So:

```
npm i -g vercel      # or: brew install vercel-cli
vercel login
vercel link          # from the repo root, creates .vercel/
```

Then:

1. **Neon** (section 1). The build needs `DATABASE_URL` before it can deploy.
2. **The auth secret** (section 5) and **R2** (section 2). Neither depends on a
   URL, so they can go in the same sitting.
3. **First deploy.** Tell me when the env vars are in and I will run it. This is
   the step that produces the URL everything else waits on, and it unblocks
   roughly thirty rubric lines in one move: F1 to F5 and R1 to R5 all begin with
   "on the live URL".
4. **GitHub and Google OAuth** (sections 3 and 4), now that you have a real
   callback URL to paste instead of a placeholder you would have to come back
   and edit.
5. **The three processor terms** (section 6) and **R7**, which needs a second
   person and can happen any time after the deploy.

Nothing here needs me present. Do them whenever suits and say when they are in.

---

## 1. Neon, the database

Free tier. https://console.neon.tech

- New project. **Region: Europe (Frankfurt), `aws-eu-central-1`.** This is a GDPR
  requirement carried in the plan, not a preference.
- Name it `vitrine`.
- Copy the **pooled** connection string, and the **direct** one for migrations.

Why Neon and not Supabase: Supabase's free tier pauses the whole project, database,
storage and auth together, after one week of inactivity. Neon suspends compute and
keeps the data. For a slow launch that difference is the product staying up.

**Correction, measured 2026-08-18.** An earlier draft of this file called
0.5 GB "the first wall in the whole stack". That is wrong and you should not
plan around it. Measured with `pg_database_size`: the whole local database is
**10.97 MB**, of which the catalogue accounts for **936 KB** at 89 items and 129
variants. Projected to the shipped catalogue of 380 variants that is about
**2.7 MB** of table data. The catalogue would have to grow roughly two hundred
times over before Neon's free tier mattered.

**The real ceiling is R2's 7 GB**, in section 2, and it arrives in slice 5 with
photographs. Your own collection is 1,334 files at 3.6 GB, which is already
half that budget, so the decision to generate thumbnails on the device (taken
for a different reason, stripping EXIF for F51) is load-bearing for storage as
well.

```
vercel env add DATABASE_URL          # pooled
vercel env add DATABASE_URL_UNPOOLED # direct, for migrations
```

## 2. Cloudflare R2, the photographs

Free tier. https://dash.cloudflare.com → R2

- Create bucket `vitrine-photos`.
- Create an R2 API token with **Object Read and Write** on that bucket only.
- Enable a public r2.dev URL for the bucket, or attach a custom domain later.

Why R2: 10 GB and **egress is free for everyone**, which is the only free storage with
real headroom. It has no free image transform pipeline, which is why thumbnails are
produced on the device at upload. That also strips EXIF, which rubric line F51 checks.

```
vercel env add R2_ACCOUNT_ID
vercel env add R2_ACCESS_KEY_ID
vercel env add R2_SECRET_ACCESS_KEY
vercel env add R2_BUCKET            # vitrine-photos
vercel env add R2_PUBLIC_BASE_URL   # the public bucket URL
```

## 3. GitHub OAuth app

https://github.com/settings/developers → New OAuth App

- Application name: `Vitrine`
- Homepage URL: the Vercel URL, once it exists
- Authorization callback URL: `<vercel-url>/api/auth/callback/github`

```
vercel env add GITHUB_CLIENT_ID
vercel env add GITHUB_CLIENT_SECRET
```

## 4. Google OAuth client

https://console.cloud.google.com → APIs and Services → Credentials → OAuth client ID
→ Web application

- Authorised redirect URI: `<vercel-url>/api/auth/callback/google`

```
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
```

## 5. The auth secret

Generate it yourself so I never see it:

```
openssl rand -base64 32
vercel env add BETTER_AUTH_SECRET
```

## 6. Accept three processor terms, and record them

This is rubric line R14, and it is one of the three OPERATOR lines. For each of
**Vercel**, **Neon** and **Cloudflare**: accept the data processing terms in the
account settings, and record the date and the data location.

Three processors, not four. With no registered domain there is no verified sending
domain, so no mail provider touches personal data in v1. Naming a processor you do
not use is itself a defect under the compliance rules, so Resend is deliberately
absent until a domain exists.

---

## What is NOT on this list, and why

- **No domain.** Your choice, and nothing else in the plan changes. The consequence
  is that the email sign-in link is built but never enabled, which is why both
  sign-in methods are OAuth.
- **No mail provider.** Follows from the above.
- **No payment, ads, donations or affiliate links.** Vercel Hobby forbids commercial
  use broadly enough that a donate button alone forces a paid plan. Rubric line R6
  counts them at zero.

## The two other OPERATOR rubric lines

- **F62.** Sign-in completes on the live URL by two independent methods and the
  session survives a browser restart. Needs a real OAuth consent screen in your
  browser.
- **R7.** A sign-in completes for an account that is not yours. Needs a second person,
  or a second account you control.

Everything else in the 130-line rubric is proved by the verifier without you.

## R4, git history. Needs your decision, not just your hands

**What I found.** `scripts/checks/no-env-values-history.ts` (new, wired into
`check:all`) walks every blob in history, not just the working tree. It reports
2 populated assignments in `.env.example` at commit `d685b72`: `DATABASE_URL`
and `DATABASE_URL_UNPOOLED`. The working tree was later cleaned to placeholders,
which is why the existing check passes and this one does not.

**How bad it is: not very.** Both are **localhost** connection strings. No
`neon.tech` value was ever committed. A local database password is not usable by
anyone who is not already on your machine, and the GitHub repository is
**private**. I never printed either value at any point, including while
classifying them.

**Why it still blocks R4.** R4 reads "0 values appear anywhere in the
repository", and `d685b72` is `origin/main` HEAD, pushed 2026-08-18 08:11:43Z.
The value is on GitHub's servers. R4 cannot be checked off while it is.

**The decision is yours because the fix is a force-push.** Rewriting `d685b72`
and force-pushing over `origin/main` is outward-facing and hard to reverse, so
I will not do it without your word. Two commits exist and nothing depends on
this history, so it is as cheap now as it will ever be. It gets worse the
longer the run goes.

**It clears two things, not one.** `d685b72` also contains your home directory,
once, in `.forge/ASSETS.md` where the collection's path was recorded. That file
is fixed in the working tree (it reads `~/Claude/My collection` now), but the
pushed commit still has it.

**Corrected since this was written.** `check:no-local-paths` scans the working
tree, and it is now **green**: 0 findings over 245 files. The 2 stale artifacts
it used to report regenerated clean when the browser harnesses re-ran, exactly
as predicted. What replaced it is a new check, `check:no-local-paths:history`,
which walks every blob in history the way the env-value twin does. It **failed on
its first run**, and the leak is larger than recorded here: **16 home-directory
paths across 3 files**, not one.

So `check:all` fails on two lines, both history, and they cost very different
things:

```
FAIL(1)  check:no-env-values:history    2 values in d685b72        PUSHED
FAIL(1)  check:no-local-paths:history   16 paths in 3 files:
                                          1 in d685b72             PUSHED
                                          15 in 8add3a4            local only
```

**Only the `d685b72` half needs your word.** It carries 3 of the 18 findings and
needs a force-push. The 15 in `8add3a4` are most of the leak by count and sit in
a commit that has never left this machine, so a local rewrite clears them with no
coordination and no risk to anyone else.

Say the word and I will rewrite the commit and force-push. Rotating the local
Postgres password is optional and trivial, and it is yours to type either way.

## Your photographs are cited as sources, and 2 things follow

**Fixed already, no action needed.** 68 catalogue sources cited your
photographs by local path, `file:///Users/<you>/Claude/My collection/IMG_xxxx.jpeg`.
That leaked your home directory into the catalogue data and would have reached
Neon on the first production seed. Every occurrence now reads
`urn:vitrine:in-hand-photograph:IMG_xxxx.jpeg`, and **`file://` sources in the
database are 0**, re-measured after the reseed.

The precise shape, because "68 sources" conflated two different things and the
database has been rebuilt since: **26 source rows** citing **13 distinct
photographs**, and **69 verifications** resting on those sources. The 138 figure
counts occurrences across the research and seed files, where the same reference
repeats.

The camera filename is kept so each row can be matched to its photograph when
you upload, and **all 13 resolve**: each one names a real file in your
directory, checked against it without copying anything. The path is gone.
Nothing had reached git: those files were never tracked and no such string
exists in any commit.

**Needs your decision, but not yet.** Those 68 sources are still not *citable*.
R10 wants every row to carry a resolvable source URL and R11 re-opens 20 sampled
rows against theirs. An unpublished personal photograph is the strongest
evidence in the rubric and the least citable thing in the world.

**18 items, 25 variants and 26 identifiers rest on one as their only source**,
concentrated in apparel, promotional-items and sponsorship-tie-ins, which are
the categories your photographs filled when they were empty.

Two ways out, and the first is the default:

1. **Slice 5 closes it by itself.** Photographs upload to R2, each source
   becomes a real object URL, and the rows become fully citable. Nothing to
   decide now.
2. **Exclude those rows from the shipped catalogue.** Smaller catalogue, fully
   citable, and it re-empties two categories.

I have not chosen between them. Option 1 costs nothing and is the plan of
record; raise it only if you want option 2.
