# Registracijos bylos

Mobili programėlė automobilių registracijos byloms sekti. Sukurta registracijos
darbuotojui — greita, paprasta, valdoma viena ranka telefone.

## Funkcijos

- **Aktyvių bylų sąrašas** — kiekviena byla atskiroje kortelėje su markės
  logotipu, modeliu, VIN, valstybiniu numeriu, vadybininku, data, salonu (L1/L3)
  ir statusais.
- **Techninio lapo statusas** — žalias / raudonas dokumento mygtukas, keičiamas
  vienu palietimu.
- **Regitra** — popierinio lėktuvėlio mygtukas pažymi, ar dokumentai atiduoti
  Regitrai (pilkas → žalias).
- **Užbaigimas** — apskritimo mygtukas su patvirtinimu perkelia bylą į archyvą.
- **Pastabos** — palietus kortelę išsiskleidžia pastabų sekcija su išsaugojimu.
- **Paieška** — pagal modelį, markę, VIN, valstybinį numerį ir vadybininką.
- **Nauja / redaguojama byla** — pilna forma su fleet režimu ir automobilių
  skaičiumi.
- **Archyvas** — pasiekiamas per antraštės mygtuką, bylas galima grąžinti.
- Duomenys saugomi lokaliai (`localStorage`), pridėti pavyzdiniai įrašai.

## Paleidimas

```bash
npm install
npm run dev      # vystymo serveris
npm run build    # produkcinė versija į dist/
```

## Technologijos

Vite + React + TypeScript, be papildomų priklausomybių. Tamsi, monochrominė
tema su mėlynais / žaliais / raudonais statusų akcentais, pritaikyta
Samsung Galaxy S24+ ir kitiems telefonams (safe-area, responsyvus išdėstymas).
