# registracijos-bylos

## Sąskaitos → Excel

Mini programėlė, kuri iš sąskaitų faktūrų (PDF) ištraukia pagrindinius duomenis
ir prideda juos į Excel failą `saskaitos.xlsx`. Veikia **visiškai offline** –
jokie duomenys niekur nesiunčiami.

Ištraukiami laukai:

| Stulpelis | Pavyzdys |
|---|---|
| Invoice number | 762828 |
| Invoice date | 2026-10-13 |
| VIN | SJNJ12TB0U2419566 |
| Kerb weight | 1574 |
| CO2 | 153,00 |
| Color | GAT Pearl Black |
| Decor | G = black (Acenta) / black charcoal (N-Connecta) |
| Factory code | TDZNLEWJ12UGC-G-MJ |
| Total sum | 26 827,60 |

Papildomai įrašoma: failo pavadinimas, įkėlimo laikas ir pastabos (jei kurio
nors lauko nepavyko rasti – eilutė vis tiek įrašoma, o pastaboje raudonai
nurodoma, ko trūksta).

### Diegimas (vieną kartą)

1. Įdiekite [Python](https://www.python.org/downloads/) (diegiant pažymėkite *Add Python to PATH*).
2. Paleiskite `idiegti.bat` (internetas reikalingas tik šiam žingsniui).

Arba sukurkite vieną `Saskaitos.exe`, kurį galima nusikopijuoti į bet kurį
kompiuterį be Python: paleiskite `sukurti_exe.bat`, rezultatas – `dist\Saskaitos.exe`.

### Naudojimas

- Paleiskite `paleisti.bat` (arba `Saskaitos.exe`) ir įmeskite PDF į langą
  (galima kelis failus arba visą aplanką), arba spauskite ant laukelio ir pasirinkite.
- Arba tiesiog nutempkite PDF failus ant `paleisti.bat` / `Saskaitos.exe`.
- Mygtukas **Atidaryti Excel** atidaro rezultatų failą.

Excel failas kuriamas šalia programos. Kitą vietą galima nurodyti aplinkos
kintamuoju `SASKAITOS_EXCEL`.

### Apsaugos

- Ta pati sąskaita (pagal numerį) antrą kartą neįrašoma.
- Jei `saskaitos.xlsx` atidarytas Excel'yje, programa praneša, kad jį reikia
  uždaryti – niekas neįrašoma pusiau ir failas nesugadinamas.
- Skenuoti PDF (be teksto) ir ne sąskaitų failai atmetami su aiškiu pranešimu.

### Testai

```
python -m unittest discover -s tests
```
