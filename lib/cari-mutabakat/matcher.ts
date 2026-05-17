import { CariRow } from "./parser";

export type MatchResult = {
  a?: CariRow;
  b?: CariRow;
  status: string;
  confidence: number;
  amountDifference: number;
};

export function matchCariRows(
  rowsA: CariRow[],
  rowsB: CariRow[]
): MatchResult[] {
  const usedB = new Set<number>();

  const results: MatchResult[] = [];

  for (const rowA of rowsA) {
    let bestMatch: CariRow | null = null;
    let bestScore = 0;

    for (const rowB of rowsB) {
      if (usedB.has(rowB.rowIndex)) continue;

      let score = 0;

      const amountDiff = Math.abs(
        rowA.amount - rowB.amount
      );

      if (amountDiff === 0) score += 60;

      if (amountDiff < 5) score += 40;

      if (
        rowA.documentNo &&
        rowB.documentNo &&
        rowA.documentNo === rowB.documentNo
      ) {
        score += 30;
      }

      if (
        rowA.description &&
        rowB.description &&
        rowA.description
          .toLowerCase()
          .includes(
            rowB.description.toLowerCase()
          )
      ) {
        score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = rowB;
      }
    }

    if (bestMatch) {
      usedB.add(bestMatch.rowIndex);

      results.push({
        a: rowA,
        b: bestMatch,
        status:
          bestScore >= 80
            ? "matched"
            : "review",

        confidence: bestScore / 100,

        amountDifference: Math.abs(
          rowA.amount - bestMatch.amount
        ),
      });
    } else {
      results.push({
        a: rowA,
        status: "missing_in_b",
        confidence: 0,
        amountDifference: rowA.amount,
      });
    }
  }

  return results;
}