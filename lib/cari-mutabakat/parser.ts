import * as XLSX from "xlsx";

export type CariRow = {
  rowIndex: number;
  date: string;
  description: string;
  documentNo: string;
  debit: number;
  credit: number;
  amount: number;
};

function parseNumber(val: any) {
  if (!val) return 0;

  if (typeof val === "number") return val;

  return Number(
    String(val)
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  ) || 0;
}

export async function parseExcelFile(
  file: File
): Promise<CariRow[]> {
  const buffer = await file.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: "array",
  });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const json = XLSX.utils.sheet_to_json<any>(sheet);

  return json.map((row, index) => {
    const debit =
      parseNumber(
        row.Borç ||
          row.BORÇ ||
          row.Debit ||
          row.debit
      );

    const credit =
      parseNumber(
        row.Alacak ||
          row.ALACAK ||
          row.Credit ||
          row.credit
      );

    return {
      rowIndex: index + 1,
      date:
        row.Tarih ||
        row.DATE ||
        row.Date ||
        "",

      description:
        row.Açıklama ||
        row.Aciklama ||
        row.Description ||
        "",

      documentNo:
        row["Belge No"] ||
        row.BelgeNo ||
        row.DocumentNo ||
        "",

      debit,
      credit,

      amount:
        debit > 0 ? debit : credit,
    };
  });
}