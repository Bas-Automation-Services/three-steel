# Section table sources

`scripts/build-catalog.ts` (`pnpm catalog`) generates `src/profiles/sourceTables.ts` from these tables,
kept here as their authors published them and under their own licences. `NOTICE.md` credits them.

| Folder | Series | Source | Licence |
|---|---|---|---|
| `ulmewix/` | IPE, IPN, HEA, HEB, HEM, UPN, UPE (EN 10365) | [ulmewix/Steel_Section_Database](https://github.com/ulmewix/Steel_Section_Database) @ 524172a3, Adam Koudelka | MIT (`ulmewix/LICENSE`) |
| `koyda/` | UB, UC, PFC (BS 4-1 / BS EN 10365) | [Koyda steel section tables](https://www.koyda.com/steel-section-tables/), Koyda Ltd, reviewed 2026-10-10/11 | CC BY 4.0 (in each file's header) |

The generator copies h, b, tw, tf and the radii and changes no value. For UB and UC, where Koyda
gives both, it takes the BS 4-1:2005 root radius (`r_bs4_2005_mm`) over the BS EN 10365 one.
Taper-flange rows keep their slope and the tf measuring point (`x_tf`, from the flange tip).
