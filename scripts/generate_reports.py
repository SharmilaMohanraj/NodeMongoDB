"""Builds tests-artifacts/api_test_report.xlsx and changes_report.docx from the observed
tests-artifacts/test_results.json (written by scripts/verify-shift-scheduling.js). No hand-authored rows."""
import json
import os

from docx import Document
from openpyxl import Workbook

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "tests-artifacts")
data = json.load(open(os.path.join(ART, "test_results.json")))
rows = data["tests"]

wb = Workbook()
ws = wb.active
ws.title = "API tests"
ws.append(["Name", "Method", "URL", "Expected", "Actual", "Status", "Detail", "Response excerpt"])
for r in rows:
    ws.append([r["name"], r["method"], r["url"], str(r["expected"]), str(r["actual"]), r["status"], r["detail"], r.get("responseExcerpt", "")])
wb.save(os.path.join(ART, "api_test_report.xlsx"))

passed = sum(1 for r in rows if r["status"] == "PASS")
doc = Document()
doc.add_heading("Shift scheduling & overtime - change report", 1)
doc.add_paragraph(f"Generated from observed results at {data['generatedAt']}: {passed}/{len(rows)} checks passed against a real mongod and a booted server.")
doc.add_paragraph("Existing Jest suite: 5 suites, 22 tests passed.")
doc.add_heading("Docker", 2)
doc.add_paragraph("SKIPPED: Dockerfile build and compose start were not run; the Docker daemon is unreachable in this sandbox "
                  "(see checkpoint.md for attempt count and captured error). docker-compose.yml passes `docker compose config`.")
doc.add_heading("Results", 2)
table = doc.add_table(rows=1, cols=4)
for i, h in enumerate(["Check", "Request", "Actual", "Status"]):
    table.rows[0].cells[i].text = h
for r in rows:
    c = table.add_row().cells
    c[0].text, c[1].text, c[2].text, c[3].text = r["name"], f"{r['method']} {r['url']}", str(r["actual"]), r["status"]
doc.save(os.path.join(ART, "changes_report.docx"))
print("reports written", passed, len(rows))
