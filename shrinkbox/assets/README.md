# assets

`human.bin` is the realistic human used for you, Mom, Dad and the wall villagers: MakeHuman's base
mesh, default skeleton + skin weights, macro body-shape targets (gender, age, muscle, weight,
ancestry), face/body detail targets and the expression units, packed and gzip'd by
`tools/human-convert.mjs`.

Source: https://github.com/makehumancommunity/makehuman (`makehuman/data`). Those assets are
released by the MakeHuman team under **CC0 1.0** (see `LICENSE.ASSETS.md` in that repository).
Thank you, MakeHuman!

To rebuild it: download the `makehuman/data` folder (base mesh, `rigs/default.*`, `targets/...`)
and run `node tools/human-convert.mjs <path to makehuman/data>`.
