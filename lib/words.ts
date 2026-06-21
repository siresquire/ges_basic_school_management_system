// Converts amounts to words for official receipts,
// e.g. 1250.5 → "One Thousand, Two Hundred and Fifty Ghana Cedis and Fifty Pesewas Only".

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
    if (n > 0) parts.push("and");
  }
  if (n >= 20) {
    const tail = n % 10 ? `-${ONES[n % 10]}` : "";
    parts.push(`${TENS[Math.floor(n / 10)]}${tail}`);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

function toWords(n: number): string {
  if (n === 0) return "Zero";
  const units: [number, string][] = [
    [1_000_000, "Million"],
    [1_000, "Thousand"],
  ];
  const parts: string[] = [];
  for (const [value, label] of units) {
    if (n >= value) {
      parts.push(`${below1000(Math.floor(n / value))} ${label}`);
      n %= value;
    }
  }
  if (n > 0) parts.push(below1000(n));
  return parts.join(", ");
}

export function cedisInWords(amount: number): string {
  const cedis = Math.floor(amount);
  const pesewas = Math.round((amount - cedis) * 100);
  let result = `${toWords(cedis)} Ghana Cedi${cedis === 1 ? "" : "s"}`;
  if (pesewas > 0) {
    result += ` and ${toWords(pesewas)} Pesewa${pesewas === 1 ? "" : "s"}`;
  }
  return `${result} Only`;
}
