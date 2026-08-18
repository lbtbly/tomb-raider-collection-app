# Vitrine, operations report

A fan-made catalogue of everything ever sold or handed out under the Tomb Raider
and Lara Croft marks, with collection management and public collector profiles.

**Status: slice 1 of 10, not deployed.** This file exists from slice 1 rather
than slice 10 because R4 requires the environment variable names to be listed
here, and a list written at the end is a list written from memory.

## Environment variables

**Names only. No value appears in this file, in this repository, or in any
agent's context.** The operator types every value into the provider's own
console or into `vercel env add`. See `docs/SECURITY.md` for the three checks
that enforce this and what each one can prove.

### Required in production

| Name | Purpose | Set where |
|---|---|---|
| `DATABASE_URL` | Pooled Postgres connection, request-time queries | `vercel env add` |
| `DATABASE_URL_UNPOOLED` | Direct connection, migrations only | `vercel env add` |

Not yet provisioned. `.forge/OPERATOR.md` carries the console steps and the
order they have to happen in.

### Planned, not yet used by any code

Named here so the list is complete rather than only current. These arrive with
photographs in slice 5 and accounts in slice 3.

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
`R2_PUBLIC_BASE_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`.

### Development and CI only, never set in production

| Name | Purpose |
|---|---|
| `NODE_ENV` | Standard Node environment flag |
| `VITRINE_BASE_URL` | Points the Playwright specs and `check:ui` at an existing origin instead of starting a server |
| `UI_CHECK_PORT` | Port for the server `check:ui` starts |
| `UI_CHECK_WIDTHS` | Override the audited viewport widths |
| `UI_CHECK_SKIP_BUILD` | Reuse `.next` when it is known current |
| `UI_CHECK_FORCE_NO_DATABASE` | Exercise the no-database branch on a machine that has a database, so CI does not discover it broken |

## Deployment URL

None. The Vercel CLI is not installed and this repository is not linked to a
project. `.forge/OPERATOR.md` has the sequence, beginning with `vercel link`.

## Rollback command

Cannot be written yet: R3 requires the command **with this project's real ids**,
and no deployment ids exist. It will read `vercel rollback <deployment-url>`
against a recorded prior deployment, executed once and reversed, with both
outputs recorded.

## launch/ contents

Empty. Slice 10.

## Checks

`npm run check:all` runs each check independently and reports each with its own
exit code, rather than an `&&` chain that stops at the first failure.

| Check | Covers |
|---|---|
| `check:barcode` | Every EAN-13 and UPC-A passes its check digit |
| `check:verification` | Every catalogue row carries a verification |
| `check:sources` | Every source carries a URL and a retrieved-on date |
| `check:no-fixture` | No fixture row on a non-local database |
| `check:no-env-values` | No populated environment value in a tracked or untracked-but-addable file |
| `check:no-local-paths` | No home-directory path in a tracked or untracked-but-addable file |
| `check:no-env-values:history` | The same, over every blob in every reachable ref |
| `check:no-local-paths:history` | Home-directory paths over every blob in every reachable ref |
| `check:ui` | Overflow, contrast, tap targets, primary sizes, spacing scale and `.srOnly`, over every built route at 390 and 1440 in both themes, widenable with `UI_CHECK_WIDTHS` |

**Two currently fail, and both are the same decision.** Both are history, both
are inside commits that are already pushed, and one rewrite clears both.

`check:no-env-values:history` finds 2 populated assignments: `DATABASE_URL` and
`DATABASE_URL_UNPOOLED` at `.env.example` lines 7 and 8, blob `c27fda2`,
introduced in `d685b72`. Both are localhost connection strings and the
repository is private, so nothing exploitable was exposed, but R4 reads *"0
values appear anywhere in the repository"* and history is part of the
repository.

`check:no-local-paths:history` is **new, and it fails on its first run**: 16
home-directory paths across 3 files, in blob `abb3649` (`.forge/ASSETS.md`,
introduced in `d685b72`) and blobs `e9900b2` and `66233c2` (two evidence JSONs,
introduced in `8add3a4`). Nothing in the suite could see these. The env-value
check had a history twin and the path check did not, so the leak had been
recorded as "1 home-directory path in one commit" when it is 16 lines in 3
files across 2 commits.

`check:no-local-paths` **passes**, 0 findings over 233 files, and passed
throughout. It was right to: the cleanup was done in the working tree, it was
simply never committed. A working-tree check cannot report what a working tree
no longer contains.

**The two commits cost very different things, and only one needs the
operator.** The remote holds `d685b72` and nothing after it, confirmed with
`git ls-remote` rather than the local tracking ref:

| Commit | Pushed | Carries | Cost to clear |
|---|---|---|---|
| `d685b72` | **yes** | 2 env values, 1 path in `.forge/ASSETS.md` | rewrite plus **force-push** |
| `8add3a4` | no | 15 paths in two evidence JSONs | local rebase, no force-push |

So the 15 paths, which are most of the leak by count, sit in local history and
can be cleaned without touching the remote at all. Only `d685b72` needs the
operator's decision, and it carries 3 of the 18 findings.

Committing the current tree makes HEAD clean going forward; it does nothing to
either set of stored blobs.

`npm run coverage:map` reports which rubric lines carry evidence. It is a
report, not a check, and is deliberately not part of `check:all`: a check that
cannot fail is noise in a suite whose value depends on every red line meaning
something.
