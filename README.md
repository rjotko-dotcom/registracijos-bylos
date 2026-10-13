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

Excel failas – tvarkingas sąskaitų registras: Nissan logotipas, pavadinimas,
suvestinė (sąskaitų skaičius ir bendra suma – skaičiuojama tik pagal
filtruotas eilutes), juoda antraštė su filtrais, užfiksuota antraštės eilutė,
skaičių/datų formatai ir paruoštas spausdinimas (A4, gulsčias, telpa į plotį).
Jei kurio nors lauko sąskaitoje nerasta – langelis pažymimas rausvai, o
užvedus pelę rodomas komentaras; abejotina reikšmė (pvz. VIN) – oranžiškai.

Jei turite ankstesnės versijos `saskaitos.xlsx`, jis automatiškai perrašomas
nauju formatu, o senasis išsaugomas kaip `saskaitos (senas formatas).xlsx`.

### Diegimas (vieną kartą)

1. Įdiekite [Python](https://www.python.org/downloads/) (diegiant pažymėkite *Add Python to PATH*).
2. Paleiskite `idiegti.bat` (internetas reikalingas tik šiam žingsniui).

Arba sukurkite vieną `Saskaitos.exe`, kurį galima nusikopijuoti į bet kurį
kompiuterį be Python: paleiskite `sukurti_exe.bat`, rezultatas – `dist\Saskaitos.exe`.

### Išvaizda

Langas sukurtas pagal Nissan stilių: juoda antraštė su Nissan logotipu,
Nissan raudona (#C3002F) akcentams, balti paviršiai ir pilki tonai.
Lange matyti: failų įmetimo laukas su apdorojimo eiga, suvestinės kortelės
(įrašyta / su pastabomis / jau buvo / klaidos) ir rezultatų lentelė
(dukart spustelėjus eilutę rodomi visi ištraukti duomenys). Excel failo vietą
galima pakeisti apačioje („Keisti…“) – ji įsimenama.

### Naudojimas

- Paleiskite `paleisti.bat` (arba `Saskaitos.exe`) ir įmeskite PDF į langą
  (galima kelis failus arba visą aplanką), arba spauskite ant laukelio ir pasirinkite.
- Arba tiesiog nutempkite PDF failus ant `paleisti.bat` / `Saskaitos.exe`.
- Mygtukas **Atidaryti Excel** atidaro rezultatų failą.

Excel failas pagal nutylėjimą kuriamas šalia programos. Vietą galima pakeisti
lange („Keisti…“) arba aplinkos kintamuoju `SASKAITOS_EXCEL`.

### Apsaugos

- Ta pati sąskaita (pagal numerį) antrą kartą neįrašoma.
- Jei `saskaitos.xlsx` atidarytas Excel'yje, programa praneša, kad jį reikia
  uždaryti – niekas neįrašoma pusiau ir failas nesugadinamas.
- Skenuoti PDF (be teksto) ir ne sąskaitų failai atmetami su aiškiu pranešimu.

### Testai

```
python -m unittest discover -s tests
```

### Logotipas

`saskaitos/assets/nissan_logo.svg` – originalas. PNG ir ICO failai sugeneruoti
su `tools/generate_assets.py` (reikia paleisti tik pakeitus logotipą).
