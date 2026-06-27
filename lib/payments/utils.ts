export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function getCardLast4(cardPan: string) {
  const cleaned = onlyDigits(cardPan);
  return cleaned.slice(-4);
}

export function maskCardPan(cardPan: string) {
  const cleaned = onlyDigits(cardPan);
  if (cleaned.length < 8) return "****";
  return `${cleaned.slice(0, 6)}******${cleaned.slice(-4)}`;
}

export function maskSensitivePaymentData<T>(data: T): T {
  const json = JSON.parse(JSON.stringify(data || {}));

  for (const key of Object.keys(json)) {
    const upper = key.toUpperCase();

    if (
      upper.includes("CARDPAN") ||
      upper.includes("CARD_NO") ||
      upper.includes("CARDNUMBER") ||
      upper.includes("PAN")
    ) {
      json[key] = maskCardPan(String(json[key] || ""));
    }

    if (
      upper.includes("CVV") ||
      upper.includes("CVC") ||
      upper.includes("CARDCVV")
    ) {
      json[key] = "***";
    }

    if (
      upper.includes("PASSWORD") ||
      upper.includes("MERCHANTPASSWORD")
    ) {
      json[key] = "***";
    }
  }

  return json;
}

export function generatePaymentNo() {
  const date = new Date();

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  const random = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `PAY-${y}${m}${d}-${random}`;
}