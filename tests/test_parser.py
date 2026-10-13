import unittest
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory

from openpyxl import load_workbook

from saskaitos.excel import append_invoices, existing_invoice_numbers
from saskaitos.parser import parse_text, to_number

# Tekstas tokio pat išdėstymo, kokį pdfplumber grąžina iš tiekėjo sąskaitos.
SAMPLE = """INVOICE
Supplier Oy
Invoice number 700001
Invoice date 05.03.2026
Customer number 10000
License number: Model: Nissan
VIN: SJNJ12TB0U1234567 Modelserie: Qashqai
Engine number : Model: MHEV 158 Xtronic 4WD N-Connecta 6B
Total weight: 2020 Color GAT Pearl Black
Kerb weight: 1574 Decor: G = black (Acenta) / black charcoal (N-Connecta)
CO2: 153,00 Key code:
Delivery date 05.03.2026 Factory code: TDZNLEWJ12UGC-G-MJ
Tariffnumber: 8703221000=ha, bensa, Country of origin: GB:UNITED KINGDOM
Order number: 500000
Specification Price €
NB028 QQ support -1 583,30
Nissan Qashqai MHEV 158 Xtronic 4WD N-Connecta 6B 26 388,36
26 827,60
Reference 10000 00070 00011 TOTAL 26 827,60
Code Description Without VAT € VAT € Total with VAT €
0 VAT 0% Intra 26 827,60 0,00 26 827,60
"""


class ParserTest(unittest.TestCase):
    def test_all_fields(self):
        inv = parse_text(SAMPLE)
        self.assertEqual(inv.invoice_number, "700001")
        self.assertEqual(inv.invoice_date, date(2026, 3, 5))
        self.assertEqual(inv.vin, "SJNJ12TB0U1234567")
        self.assertEqual(inv.kerb_weight, 1574)
        self.assertEqual(inv.co2, 153.0)
        self.assertEqual(inv.color, "GAT Pearl Black")
        self.assertEqual(inv.decor, "G = black (Acenta) / black charcoal (N-Connecta)")
        self.assertEqual(inv.factory_code, "TDZNLEWJ12UGC-G-MJ")
        self.assertEqual(inv.total, 26827.60)
        self.assertEqual(inv.missing, [])
        self.assertEqual(inv.warnings, [])

    def test_missing_fields_reported(self):
        inv = parse_text(SAMPLE.replace("CO2: 153,00 ", "").replace("Decor: ", "X: "))
        self.assertIn("CO2", inv.missing)

    def test_numbers(self):
        self.assertEqual(to_number("26 827,60"), 26827.6)
        self.assertEqual(to_number("-1 583,30"), -1583.3)
        self.assertEqual(to_number("1 574"), 1574)
        self.assertEqual(to_number("1.574"), 1574)
        self.assertEqual(to_number("153,00"), 153.0)


class ExcelTest(unittest.TestCase):
    def test_append_and_duplicates(self):
        with TemporaryDirectory() as d:
            path = Path(d) / "out.xlsx"
            append_invoices(path, [parse_text(SAMPLE, "a.pdf")])
            append_invoices(path, [parse_text(SAMPLE.replace("700001", "700002"), "b.pdf")])
            self.assertEqual(existing_invoice_numbers(path), {"700001", "700002"})
            rows = list(load_workbook(path)["Saskaitos"].iter_rows(values_only=True))
            self.assertEqual(len(rows), 3)
            self.assertEqual(rows[1][:5], ("700001", rows[1][1], "SJNJ12TB0U1234567", 1574, 153))
            self.assertEqual(rows[1][8], 26827.6)


if __name__ == "__main__":
    unittest.main()
