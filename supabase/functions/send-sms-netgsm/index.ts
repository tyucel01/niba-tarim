import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type SupabaseSmsHookPayload = {
  user?: {
    phone?: string;
  };
  sms?: {
    otp?: string;
    message?: string;
  };
  phone?: string;
  otp?: string;
  message?: string;
};

const NETGSM_USERCODE = Deno.env.get("NETGSM_USERCODE") || "";
const NETGSM_PASSWORD = Deno.env.get("NETGSM_PASSWORD") || "";
const NETGSM_MSGHEADER = Deno.env.get("NETGSM_MSGHEADER") || "";

function normalizePhone(phone: string) {
  let cleaned = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+90")) cleaned = "90" + cleaned.slice(3);
  if (cleaned.startsWith("0")) cleaned = "90" + cleaned.slice(1);
  if (cleaned.startsWith("5") && cleaned.length === 10) cleaned = "90" + cleaned;

  return cleaned;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!NETGSM_USERCODE || !NETGSM_PASSWORD || !NETGSM_MSGHEADER) {
    return new Response(
      JSON.stringify({ error: "Netgsm secrets are missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const payload = (await req.json()) as SupabaseSmsHookPayload;

    console.log("HOOK PAYLOAD:", JSON.stringify(payload));

    const phone = payload.phone || payload.user?.phone || "";
    const otp = payload.otp || payload.sms?.otp || "";

    const message =
      payload.message ||
      payload.sms?.message ||
      `Niba Tarım admin giriş kodunuz: ${otp}`;

    if (!phone) {
      return new Response(JSON.stringify({ error: "Phone is missing" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const gsm = normalizePhone(phone);

    const netgsmPayload = {
      msgheader: NETGSM_MSGHEADER,
      messages: [
        {
          msg: message,
          no: gsm,
        },
      ],
      encoding: "TR",
    };

    const auth = btoa(`${NETGSM_USERCODE}:${NETGSM_PASSWORD}`);

    const netgsmResponse = await fetch("https://api.netgsm.com.tr/sms/rest/v2/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(netgsmPayload),
    });

    const resultText = await netgsmResponse.text();

    console.log("NETGSM PAYLOAD:", JSON.stringify(netgsmPayload));
    console.log("NETGSM RESULT:", resultText);

    if (!netgsmResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Netgsm request failed",
          status: netgsmResponse.status,
          result: resultText,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    let result: any = null;

    try {
      result = JSON.parse(resultText);
    } catch {
      result = resultText;
    }

    const success =
      resultText.startsWith("00") ||
      resultText.includes('"code":"00"') ||
      resultText.includes('"code": "00"');

    if (!success) {
      return new Response(
        JSON.stringify({
          error: "Netgsm returned error",
          result,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Unexpected error",
        detail: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});