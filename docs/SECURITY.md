# Secret handling

The `secret-guard` hook refuses commands that touch a secret path and tells you
to read this file. This is that file.

## The rule

**No secret value enters an agent's context, ever.** Not to be read, not to be
checked, not to be pasted into a report. The operator types every value into the
provider's own console or into `vercel env add`. No agent has seen one and none
needs to.

This is not caution for its own sake. A value in a transcript is a value in a
log, a summary, and a context window that gets compacted and re-summarised.
There is no way to un-say it.

## What runs, and what each check can prove

Five layers, each covering what the ones before it cannot.

| Check | Scope | Catches |
|---|---|---|
| `secret-guard` hook | commands, before they run | a command about to read a secret path |
| `npm run check:no-env-values` | every tracked **and untracked-but-addable** file | a populated value committed, or one `git add .` from it |
| `npm run check:no-env-values:history` | every blob in every reachable ref | a value committed once and later removed |
| `npm run check:no-local-paths` | every tracked **and untracked-but-addable** file | a home directory naming the machine and its owner |
| `npm run check:no-local-paths:history` | every blob in every reachable ref | a home directory committed once and later cleaned |

**Both history checks exist because of real findings, and the second one
repeats the first one's lesson.** The env-value pair was built as a pair. The
path check was not, and for a while nothing in the suite could see a home
directory that had been committed and then cleaned. When the twin was finally
written it failed on its first run: 16 paths across 3 files in 2 commits, where
the gap had been recorded as one path in one commit. The working-tree check was
green the whole time and was correct to be, because the cleanup had been done
and simply never committed.

The shared patterns now live in `src/repo-hygiene/local-path-scan.ts` and both
path checks import them. A rule retyped into a second file is a rule with two
versions, and that is how the first blind spot survived as long as it did.

**The env-value history check exists because of a real finding.** Two `DATABASE_URL`
values sit in `.env.example` at commit `d685b72`. The working tree was cleaned
to placeholders afterwards, so the working-tree check passes and the history
check does not. Both are localhost connection strings and the repository is
private, so nothing exploitable was exposed, but R4 reads *"0 values appear
anywhere in the repository"* and history is part of the repository. Clearing it
needs the commit rewritten and a force-push, which is the operator's decision.

## How the checks avoid becoming the leak

A check that prints what it found would defeat itself. Both value checks report
**file, line, and variable name, and never the value**. The output is safe to
paste into a CI log, an issue, or a chat.

The classifier is deliberately not "does this look like `KEY=value`", which
would flag `NODE_ENV=development` and be ignored within a week. It is "does this
specific value look like a secret": a connection string carrying embedded
credentials, a recognisable API-key prefix, or a long no-whitespace token mixing
case and digits the way a generated credential does and a word does not. It
lives in `src/repo-hygiene/env-value-scan.ts` and is unit tested without
touching the filesystem or git.

## Personal data that is not a secret but is still yours

The operator's photographs are personal files. They stay on the operator's
machine: never copied into the repository, never committed, never uploaded
anywhere except through the product's own upload path to a bucket the operator
owns.

**A path is not a photograph, and it still leaked.** 68 catalogue sources cited
those photographs as `file:///Users/<home>/Claude/My collection/IMG_xxxx.jpeg`,
which put a home directory into the catalogue data and would have carried it to
the hosted database on the first production seed. They now read
`urn:vitrine:in-hand-photograph:IMG_xxxx.jpeg`: the camera filename is kept so
each row can be matched to its upload, and the path is gone.

## If the guard blocks you

Do not route around it. It matches on command text, so it sometimes fires on a
command that is dense with credential vocabulary but touches nothing sensitive.
That has happened twice in this project, both times on a heredoc writing a
*check* for secrets. Write the file with the normal file-writing path instead,
and say plainly in your report that the guard fired and why the action was safe.
Switching tools to accomplish something the guard genuinely intended to stop is
a different act, and not one to take quietly.
