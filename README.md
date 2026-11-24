# The World in One Page — Tuesday 24 November 2026

[![make.fun · news-image-20261124](https://make.fun/badge/news-image-20261124.svg)](https://make.fun/bounty/news-image-20261124?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124)
[![rank](https://make.fun/badge/news-image-20261124/indraHA01/makefun-news-image-20261124/rank.svg)](https://make.fun/bounty/news-image-20261124/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124)
[![reward](https://make.fun/badge/news-image-20261124/indraHA01/makefun-news-image-20261124/reward.svg)](https://make.fun/bounty/news-image-20261124?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124)

Entry for the [news-image-20261124](https://make.fun/bounty/news-image-20261124) bounty on make.fun: a program that draws one newspaper front page summing up the world's news of **Tuesday 24 November 2026** and writes it to `/output/entry.png`.

## The day it sums up

- **Ukraine sinks a Russian warship off Libya** — seven sea drones sink the corvette Merkury in Benghazi harbour; a Ka-27 helicopter is destroyed and the cargo ship Angara is hit.
- **COP31 ends with no deal** — the longest climate summit on record collapses in Antalya; the EU and others reject a final text with no mention of fossil fuels.
- **24 dead in the Indonesia factory fire** — a blaze at a candy plant in Serang kills 24; about 30 workers are still missing as rescuers search the wreckage.
- **Kyiv strikes kill 14** — Russian missiles and drones hit homes across the Kyiv region.
- **India and China hold border talks** — commanders meet in Arunachal Pradesh to ease tensions.
- **Chess crown defence begins** — Gukesh defends his world title against Sindarov in Geneva.
- **Also:** the UK will host the 2035 Women's World Cup, Alcaraz wins his first ATP Finals, Iran vows a response to the US Hormuz blockade, and the Russian ship Sparta II is ablaze off Finland.

## How it works

`main.ts` (Node 22, standard library only) draws the page with a hand-rolled rasterizer — framebuffer, rectangles, lines, circles and polygons, a 5×7 bitmap font authored in the file, and a hand-rolled PNG encoder (zlib + CRC32). No network, no bundled image assets, no clock, no randomness: every run writes the same bytes.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The output is a 1024×1024 PNG, well under the 1 MiB limit. Two consecutive runs produce byte-identical output (verified by SHA-256).

## License

MIT — see [LICENSE](LICENSE).
