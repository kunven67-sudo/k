# AI School Helper 🤖📓

Meet **Bolt**, a robot tutor for kids (Kindergarten through college). You tell
Bolt your grade, then he helps with math, reading, spelling, writing and
grammar, science and social studies. He explains things super simply, and he
**doesn't hand out answers**: he asks questions and gives hints so you figure
it out yourself.

**Use it here:** https://claude.ai/artifact/72X2a1NWuqGwob4SgxnLNi
(private to its owner until it's shared from the page's Share menu).

## What it does

- **Ask anything**: type what you're stuck on ("I need help reading",
  "how do I do 7 × 8?") or snap a 📸 photo of your homework.
- **😕 I still don't get it**: one tap and Bolt explains it a brand-new,
  simpler way. Also 💡 Hint, 🧩 Example (a *different* problem like yours,
  solved step by step) and ✅ Got it!
- **Learn something new**: lesson topics picked for your grade in every
  subject. Tap one for a mini-lesson and a practice question.
- **Practice**: 📝 multiple-choice quizzes for any subject, and 🔤 spelling
  tests where Bolt says the word out loud (bring your own list from school,
  or let Bolt pick words).
- **⭐ Stars, 🔥 streaks and levels** for figuring things out.
- **🔊 Read it to me**: any answer can be read out loud, or turn on
  auto-read in Settings.
- **Saved chats + memory**: chats are saved, and after each chat Bolt writes
  short notes ("still learning 8 × tables", "likes soccer examples") so he
  remembers you next time. You can see and delete those notes on the home
  page.
- **More than one learner**: brothers and sisters each get their own profile,
  stars and chats.

## How it runs

`index.html` is published as a claude.ai Artifact. There it uses three
Artifact capabilities:

| Capability | Used for |
| --- | --- |
| `sample` | Bolt's brain: asks Claude, on the viewer's own Claude account (the first time, Claude asks the viewer to allow it) |
| `db` + `user` | Saves learners, chats and Bolt's notes in the viewer's private `data/users/<id>/` space, so nobody else can see them |

Opened anywhere else (a plain file, another website), Bolt can't reach
Claude, so the app saves to the browser instead and still offers offline math
practice and spelling tests with your own word list.

The file is a page *fragment* (no `<html>`/`<head>`): claude.ai wraps it in
its own document skeleton when it's published.

## Developing

`dev/mock-claude.js` is a fake claude.ai runtime with canned answers, and
`dev/test.mjs` drives the whole app in headless Chromium with it (onboarding,
chats, re-explaining, stars, photos, quizzes, spelling tests, settings,
errors, bad-connection cases, phone width and dark mode).

```sh
node dev/test.mjs                    # run every check
node dev/test.mjs --only quiz        # run the checks whose name matches
node dev/test.mjs --shots out/       # also save screenshots
node dev/test.mjs --preview          # write dev/preview.html to click around locally
```

The tests need Playwright (`npm i -D playwright`, or a global install).
