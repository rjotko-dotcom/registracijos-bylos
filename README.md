# Frėja 🐾

Jauki pikselinės stilistikos PWA programėlė, skirta katytei Frėjai — maitinimo priminimai, priežiūros žurnalas ir interaktyvi Frėja su animacijomis, garsais bei paslaptimis.

A cozy pixel-art PWA companion app for the real cat Frėja — feeding reminders, care tracking and an interactive Frėja with animations, sounds and secrets.

## Paleidimas / Getting started

```bash
npm install
npm run dev        # development server
npm run build      # production build (dist/)
npm run preview    # serve the production build
npm test           # run the test suite (vitest)
npm run typecheck  # TypeScript check
npm run assets     # regenerate PWA icons + placeholder audio from source art
```

Programėlę galima įdiegti į telefono pradžios ekraną (PWA): naršyklėje pasirinkite „Add to Home screen" / „Įdiegti programėlę".

## Funkcijos / Features

- **Interaktyvi Frėja** — paspausk (užsimerkia), palaikyk (murkia su garsu ir vibracija), 5 greiti bakstelėjimai (miau!), dvigubas bakstelėjimas (širdelė)
- **Maitinimas** — fiksuoti tvarkaraščiai ir intervalai kartu, greitas „Pamaitinta" mygtukas su atšaukimu, tipas/gramai/pastabos/laikas
- **Istorija** — dienos ir savaitės vaizdas, anksti/laiku/vėlai ženkliukai, redagavimas
- **Priežiūra** — pritaikomi priežiūros veiksmai su piktogramomis ir istorija
- **Kolekcija** — 12 kolekcionuojamų daiktų, velykiniai kiaušiniai, 7 dienų serijos apdovanojimas
- **XP ir lygiai** — tik teigiama progresija, jokių bausmių
- **Atsitiktiniai įvykiai** — mirksėjimas, žiovavimas, miegas, musė, naktinė peteliškė, dėžė, karūnėlė, zoomies…
- **LT / EN kalbos**, šviesi/naktinė tema, ramybės valandos, duomenų eksportas/importas
- **Offline PWA** — visi duomenys saugomi telefone (IndexedDB)

## Architektūra / Architecture

- React + TypeScript + Vite + `vite-plugin-pwa`
- Zustand būsenai, Dexie (IndexedDB) duomenims
- UI niekada nesikreipia į Dexie tiesiogiai — tik per repozitorijų sąsajas (`src/data/repositories/types.ts`)
- Paruošta būsimai sinchronizacijai — žr. [docs/SYNC.md](docs/SYNC.md)
- Garso/vibracijos/kadrų keitimas — žr. [docs/ASSETS.md](docs/ASSETS.md)

## Testai

61 testas dengia tvarkaraščių skaičiavimą (fiksuoti, intervaliniai, mišrūs, per vidurnaktį), XP ir anti-farm apsaugą, gestus (5 bakstelėjimai, ilgas paspaudimas, atšaukimas), atsitiktinių įvykių planuoklį, vertimus ir IndexedDB repozitorijas su eksportu/importu.
