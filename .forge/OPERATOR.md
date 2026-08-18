# Operator checklist

Six things need your consoles. I cannot create accounts, enter credentials, or accept
terms on your behalf, and I will never write a secret value into this repository.

Do these whenever suits. The build continues without them; they gate the live URL and
the three OPERATOR rubric lines, not the code.

Every value goes in through `vercel env add`, typed by you, never pasted to me.

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

Watch: 0.5 GB storage is the first wall in the whole stack.

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
