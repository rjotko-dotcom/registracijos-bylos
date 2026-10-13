import unittest
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory

from openpyxl import Workbook, load_workbook

from saskaitos.excel import HEADER_ROW, HEADERS, TABLE, append_invoices, existing_invoice_numbers
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
            ws = load_workbook(path)["Sąskaitos"]
            self.assertEqual([c.value for c in ws[HEADER_ROW]], HEADERS)
            rows = list(ws.iter_rows(min_row=HEADER_ROW + 1, values_only=True))
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0][2:5], ("SJNJ12TB0U1234567", 1574, 153))
            self.assertEqual(rows[0][8], 26827.6)
            self.assertEqual(ws.tables[TABLE].ref, f"A{HEADER_ROW}:I{HEADER_ROW + 2}")

    def test_missing_field_highlighted(self):
        with TemporaryDirectory() as d:
            path = Path(d) / "out.xlsx"
            append_invoices(path, [parse_text(SAMPLE.replace("CO2: 153,00 ", ""), "a.pdf")])
            cell = load_workbook(path)["Sąskaitos"].cell(HEADER_ROW + 1, 5)
            self.assertIsNone(cell.value)
            self.assertIsNotNone(cell.comment)

    def test_old_format_is_migrated(self):
        with TemporaryDirectory() as d:
            path = Path(d) / "out.xlsx"
            wb = Workbook()
            ws = wb.active
            ws.title = "Saskaitos"
            ws.append(["Invoice number", "Invoice date", "VIN", "Kerb weight", "CO2", "Color", "Decor",
                       "Factory code", "Total sum", "Failas", "Įkelta", "Pastabos"])
            ws.append(["600001", date(2026, 1, 2), "SJNJ12TB0U7654321", 1500, 140.0, "Red", "X", "F", 100.0,
                       "x.pdf", None, None])
            wb.save(path)
            append_invoices(path, [parse_text(SAMPLE, "a.pdf")])
            self.assertEqual(existing_invoice_numbers(path), {"600001", "700001"})
            self.assertTrue((Path(d) / "out (senas formatas).xlsx").exists())
            new = load_workbook(path)
            self.assertEqual(new.sheetnames, ["Sąskaitos"])
            self.assertEqual(new["Sąskaitos"].max_column, len(HEADERS))


if __name__ == "__main__":
    unittest.main()
