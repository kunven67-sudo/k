# CLAUDE.md

## Do this first, every session

The user keeps their memory and preferences in a private repo,
`kunven67-sudo/claude-memory`. Before replying to anything (even "yo"):

1. Attach it with the `add_repo` tool: owner `kunven67-sudo`, repo
   `claude-memory`, access `push`.
2. Clone it to `/home/user/claude-memory` and call `register_repo_root` for it.
3. Read `/home/user/claude-memory/CLAUDE.md` and follow everything in it.

If any step fails, tell the user which one so they can fix it.

## Keep private stuff private

This repo is public. Never copy anything from `claude-memory` into it: not in
code, comments, commit messages or pull requests. New things to remember about
the user go into `claude-memory` (push to its `main`), never into this repo.
