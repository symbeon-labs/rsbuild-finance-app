import { ReceivableTitle } from "./reconciliation";
import { FinancialRecord } from "./finance";
import mdsJson from "./operational-data-mds.json";

export interface OperationalDataset {
  organization: string;
  generatedAt: string;
  counts: {
    aVencer: number;
    emAtraso: number;
    recebidos: number;
    totalTitles: number;
    itauRecords: number;
    safraRecords: number;
    totalBankRecords: number;
  };
  titles: ReceivableTitle[];
  bankRecords: FinancialRecord[];
}

export const MUNDO_DO_SABOR_DATASET = mdsJson as unknown as OperationalDataset;
export const MUNDO_DO_SABOR_TITLES: ReceivableTitle[] = MUNDO_DO_SABOR_DATASET.titles;
export const MUNDO_DO_SABOR_BANK_RECORDS: FinancialRecord[] = MUNDO_DO_SABOR_DATASET.bankRecords;
