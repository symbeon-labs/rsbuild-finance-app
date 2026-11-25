import openpyxl, os, json, re

BASE_PATH = r"G:\.shortcut-targets-by-id\1HQk_xNQmoBT8iQTL0G-aeIvY3RFFcYKf\Mundo do Sabor e Hub Açai\DADOS_OPERACIONAIS\Mundo_Do_Sabor"
RECEIVABLES_DIR = os.path.join(BASE_PATH, "COLOQUE_EVIDÊNCIAS_OPERACIONAIS_AQUI_EM_PASTAS", "3. Contas a receber")
STATEMENTS_DIR = os.path.join(BASE_PATH, "COLOQUE_EVIDÊNCIAS_OPERACIONAIS_AQUI_EM_PASTAS", "1. Extratos bancários")
OUTPUT_PATH = r"c:\Users\João\Desktop\PROJETOS\05_PLATFORMS\rsbuild-finance-app\lib\operational-data-mds.json"

def load_a_vencer():
    fpath = os.path.join(RECEIVABLES_DIR, "CONTAS A RECEBER A VENCER.xlsx")
    wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))[3:]
    titles = []
    idx = 1
    for r in rows:
        if not r[1] or not r[3]:
            continue
        titles.append({
            "id": f"tit-mds-av-{idx}",
            "documentNumber": str(r[3]).strip(),
            "customerName": str(r[1]).strip(),
            "emissionDate": str(r[2])[:10] if r[2] else "",
            "dueDate": str(r[5])[:10] if r[5] else "",
            "amount": round(float(r[4]), 2) if r[4] else 0.0,
            "balance": round(float(r[7]), 2) if r[7] else 0.0,
            "paidAmount": round(float(r[6]), 2) if r[6] else 0.0,
            "bankAccount": str(r[8]).strip() if r[8] else "Itaú Unibanco",
            "status": "pendente",
            "category": "a_vencer"
        })
        idx += 1
    return titles

def load_em_atraso():
    fpath = os.path.join(RECEIVABLES_DIR, "CONTAS A RECEBER EM ATRASO.xlsx")
    wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))[3:]
    titles = []
    idx = 1
    for r in rows:
        if not r[1] or not r[3]:
            continue
        titles.append({
            "id": f"tit-mds-at-{idx}",
            "documentNumber": str(r[3]).strip(),
            "customerName": str(r[1]).strip(),
            "emissionDate": str(r[2])[:10] if r[2] else "",
            "dueDate": str(r[5])[:10] if r[5] else "",
            "amount": round(float(r[4]), 2) if r[4] else 0.0,
            "balance": round(float(r[7]), 2) if r[7] else 0.0,
            "paidAmount": round(float(r[6]), 2) if r[6] else 0.0,
            "bankAccount": str(r[8]).strip() if r[8] else "Itaú Unibanco",
            "status": "pendente",
            "category": "em_atraso"
        })
        idx += 1
    return titles

def load_recebidos():
    fpath = os.path.join(RECEIVABLES_DIR, "CONTAS A RECEBER RECEBIDOS.xlsx")
    wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))[3:]
    titles = []
    idx = 1
    for r in rows:
        if not r[1] or not r[2]:
            continue
        titles.append({
            "id": f"tit-mds-rec-{idx}",
            "documentNumber": str(r[2]).strip(),
            "customerName": str(r[1]).strip(),
            "emissionDate": str(r[3])[:10] if r[3] else "",
            "dueDate": str(r[4])[:10] if r[4] else "",
            "settlementDate": str(r[5])[:10] if r[5] else "",
            "amount": round(float(r[6]), 2) if r[6] else 0.0,
            "discount": round(float(r[7]), 2) if r[7] else 0.0,
            "interest": round(float(r[8]), 2) if r[8] else 0.0,
            "fine": round(float(r[9]), 2) if r[9] else 0.0,
            "paidAmount": round(float(r[10]), 2) if r[10] else 0.0,
            "bankAccount": "Itaú Unibanco",
            "status": "pendente", # Para possibilitar reconciliação com extrato
            "originalStatus": "recebido_erp",
            "category": "recebido_erp"
        })
        idx += 1
    return titles

def parse_ofx(file_path, bank_name):
    records = []
    if not os.path.exists(file_path):
        return records
    with open(file_path, "r", encoding="latin1") as f:
        text = f.read()

    blocks = text.split("<STMTTRN>")
    idx = 1
    for block in blocks[1:]:
        end_idx = block.find("</STMTTRN>")
        content = block[:end_idx] if end_idx != -1 else block

        dt_m = re.search(r"<DTPOSTED>(\d{8})", content)
        amt_m = re.search(r"<TRNAMT>([\d\.\-]+)", content)
        fitid_m = re.search(r"<FITID>(.*?)[\r\n<]", content)
        memo_m = re.search(r"<MEMO>(.*?)[\r\n<]", content)

        if not (dt_m and amt_m):
            continue

        dt = dt_m.group(1)
        val = float(amt_m.group(1))
        fitid = fitid_m.group(1).strip() if fitid_m else f"fit-{idx}"
        memo = memo_m.group(1).strip() if memo_m else ""

        records.append({
            "id": f"rec-mds-{bank_name.lower().replace(' ', '-')}-{idx}",
            "sourceRecordId": fitid,
            "date": f"{dt[:4]}-{dt[4:6]}-{dt[6:8]}",
            "amount": abs(val),
            "direction": "entrada" if val > 0 else "saida",
            "description": memo,
            "bankName": bank_name,
            "category": "Recebimentos Diversos",
            "status": "pendente",
            "source": f"OFX {bank_name}"
        })
        idx += 1
    return records

if __name__ == "__main__":
    a_vencer = load_a_vencer()
    em_atraso = load_em_atraso()
    recebidos = load_recebidos()

    ofx_itau = os.path.join(STATEMENTS_DIR, "ITAU Extrato_7421_996567_17-11-2026.ofx")
    ofx_safra = os.path.join(STATEMENTS_DIR, "Safra PJ - Extrato de Movimentação (3).ofx")

    itau_records = parse_ofx(ofx_itau, "Itaú Unibanco")
    safra_records = parse_ofx(ofx_safra, "Banco Safra")

    output = {
        "organization": "Mundo do Sabor (ALS COMERCIO ATACADISTA VAREJISTA)",
        "generatedAt": "2026-11-24",
        "counts": {
            "aVencer": len(a_vencer),
            "emAtraso": len(em_atraso),
            "recebidos": len(recebidos),
            "totalTitles": len(a_vencer) + len(em_atraso) + len(recebidos),
            "itauRecords": len(itau_records),
            "safraRecords": len(safra_records),
            "totalBankRecords": len(itau_records) + len(safra_records)
        },
        "titles": a_vencer + em_atraso + recebidos,
        "bankRecords": itau_records + safra_records
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("SUCCESS: JSON gerado com sucesso!")
    print(json.dumps(output["counts"], indent=2))
