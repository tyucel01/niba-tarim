const BASE = "https://api.parasut.com";
export async function cardLedgerToken() {
  const response = await fetch(`${BASE}/oauth/token`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({grant_type:"password",client_id:process.env.PARASUT_CLIENT_ID,client_secret:process.env.PARASUT_CLIENT_SECRET,username:process.env.PARASUT_USERNAME,password:process.env.PARASUT_PASSWORD,redirect_uri:"urn:ietf:wg:oauth:2.0:oob"}),cache:"no-store",signal:AbortSignal.timeout(15000)});
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("Paraşüt bağlantısı kurulamadı.");
  return String(data.access_token);
}
export async function createCardLedgerTransaction(params:{contactId:string;transactionType:"payment"|"collection";date:string;amount:number;description?:string;accountId?:string}) {
  const company = process.env.PARASUT_COMPANY_ID, account = params.accountId || process.env.PARASUT_ACCOUNT_ID;
  if (!company || !account || !/^\d+$/.test(account)) throw new Error("Paraşüt firma veya hesap ayarı eksik.");
  const token = await cardLedgerToken();
  const endpoint = params.transactionType === "payment" ? "contact_debit_transactions" : "contact_credit_transactions";
  let response;
  try {response = await fetch(`${BASE}/v4/${company}/contacts/${encodeURIComponent(params.contactId)}/${endpoint}`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({data:{type:"transactions",attributes:{description:params.description || "Kart çekimi",account_id:Number(account),date:params.date,amount:params.amount}}}),cache:"no-store",signal:AbortSignal.timeout(20000)});}
  catch {throw new Error("Paraşüt sonucu belirsiz; yeniden kayıt oluşturmadan kontrol edin.");}
  const json = await response.json();
  if (!response.ok || !json?.data?.id) throw new Error("Paraşüt tahsilatı doğrulanamadı; yeniden denemeden kontrol edin.");
  return json;
}

// The owner approved reusing the existing Card Transactions account for both approved Niba POS merchants.
// Unknown merchants remain unmapped unless explicitly configured.
export function paratikaLedgerAccount(merchant:string,env=process.env){
 return env[`PARATIKA_${merchant}_PARASUT_ACCOUNT_ID`] || (['10013929','10013922'].includes(merchant)?env.PARASUT_ACCOUNT_ID:undefined);
}
