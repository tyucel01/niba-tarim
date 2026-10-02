/* Niba Tarım aktarımı. Anahtarı BURAYA yazmayın; Script Properties kullanın.
 * Ayrı, yalnızca sizin eriştiğiniz bir Apps Script projesine ekleyin.
 * Hiçbir hücreye yazmaz, hiçbir fatura oluşturmaz.
 */
const NIBA_ENDPOINT = 'https://www.nibatarim.com/api/integrations/sheets/orders';
const NIBA_COLUMNS = {
  satisId: ['Satış ID', 'Satis ID', 'satisId'],
  satisTarihi: ['Satış Tarihi', 'Satis Tarihi', 'satisTarihi'],
  bayi: ['Bayi', 'Müşteri', 'Musteri', 'Cari'],
  tedarikciler: ['Tedarikçiler', 'Tedarikciler', 'Tedarikçi', 'Tedarikci'],
  siparisAlan: ['Sipariş Alan', 'Siparis Alan'], urun: ['Ürün', 'Urun', 'Malzeme'], marka: ['Marka'],
  alisFiyati: ['Alış Fiyatı', 'Alis Fiyati'], pesinSatisFiyati: ['Peşin Satış Fiyatı', 'Pesin Satis Fiyati'],
  siparisTonaj: ['Sipariş', 'Siparis', 'Tonaj', 'Miktar'], teslimOlanTonaj: ['Teslim Olan Tonaj'],
  satisTuru: ['Satış Türü', 'Satis Turu'], vadeTarihi: ['Vade Tarihi'], vadeFarki: ['Vade Farkı', 'Vade Farki'],
  vadeSuresi: ['Vade Süresi', 'Vade Suresi'], not: ['Not', 'Açıklama', 'Aciklama'], nakliye: ['Nakliye'],
  plaka: ['Plaka'], sevkYeri: ['Sevk Yeri'], sevkDurumu: ['Sevk Durumu'], sevkNo: ['Sevk No'], gts: ['GTS']
};
function nNormalize(value) {
  return String(value == null ? '' : value).toLowerCase().trim().replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c').replace(/[^a-z0-9]/g,'');
}
function nDate(value, timezone) {
  if (value instanceof Date) return Utilities.formatDate(value, timezone, 'yyyy-MM-dd');
  const text = String(value).trim();
  const m = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  return m ? (m[3].length===2 ? '20'+m[3] : m[3])+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0') : text;
}
function nStatus(field, value) {
  const key = nNormalize(value);
  if(field==='gts') {
    if(['evet','girildi','cikis','cikisyapildi','yapildi','tamam','true','1'].includes(key)) return 'Girildi';
    if(['hayir','yok','false','0'].includes(key)) return 'Yok';
    if(key==='bekliyor') return 'Bekliyor';
  }
  if(field==='sevkDurumu') {
    if(['evet','sevkedildi','yapildi','true','1'].includes(key)) return 'Sevk Edildi';
    if(['tamam','tamamlandi'].includes(key)) return 'Tamamlandı';
    if(['hayir','yok','bekliyor','false','0'].includes(key)) return 'Bekliyor';
    if(key==='kismisevk') return 'Kısmi Sevk';
    if(key==='iptal') return 'İptal';
  }
  return String(value).trim(); // Unknown values are rejected by the server, never guessed.
}
function nReadRows(sheet) {
  const matrix = sheet.getDataRange().getValues();
  if(matrix.length<2) return [];
  const headers = matrix[0].map(nNormalize), mapping = {};
  Object.keys(NIBA_COLUMNS).forEach(field => {
    const aliases = NIBA_COLUMNS[field].map(nNormalize);
    const indexes = headers.map((h,i)=>aliases.includes(h)?i:-1).filter(i=>i>=0);
    if(indexes.length>1) throw new Error('Birden fazla eşleşen sütun: '+field);
    if(indexes.length) mapping[field]=indexes[0];
  });
  ['satisId','bayi','urun','siparisTonaj','pesinSatisFiyati'].forEach(field=>{if(mapping[field]===undefined) throw new Error('Zorunlu sütun yok: '+NIBA_COLUMNS[field][0]);});
  const rows=[], seen=new Set(), tz=sheet.getParent().getSpreadsheetTimeZone();
  matrix.slice(1).forEach((cells,index)=>{
    const values={};
    Object.keys(mapping).forEach(field=>{
      let value=cells[mapping[field]];
      if(value===''||value===null) return;
      if(field==='satisTarihi'||field==='vadeTarihi') value=nDate(value,tz);
      else if(field==='sevkDurumu'||field==='gts') value=nStatus(field,value);
      else if(!['alisFiyati','pesinSatisFiyati','siparisTonaj','teslimOlanTonaj','vadeFarki','nakliye'].includes(field)) value=String(value).trim();
      values[field]=value;
    });
    if(!Object.keys(values).length) return;
    const id=String(values.satisId||'').trim();
    if(!id) throw new Error('Satır '+(index+2)+': Satış ID boş. Hiçbir satır gönderilmedi.');
    if(seen.has(id)) throw new Error('Satır '+(index+2)+': Tekrarlanan Satış ID. Hiçbir satır gönderilmedi.');
    seen.add(id); rows.push({rowNumber:index+2,values});
  });
  return rows;
}
function nRun(forceDryRun) {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) throw new Error('Başka bir aktarım çalışıyor.');
  try {
    const properties=PropertiesService.getScriptProperties();
    const secret=properties.getProperty('SHEETS_SYNC_SECRET');
    const sourceId=properties.getProperty('SHEETS_SYNC_SOURCE_ID');
    const spreadsheetId=properties.getProperty('SPREADSHEET_ID');
    const sheetName=properties.getProperty('SHEET_NAME');
    if(!secret||secret.length<32||!sourceId||!spreadsheetId||!sheetName) throw new Error('Script Properties ayarları eksik.');
    const dryRun=forceDryRun || properties.getProperty('DRY_RUN')!=='false';
    const sheet=SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
    if(!sheet) throw new Error('Belirtilen sekme bulunamadı.');
    const rows=nReadRows(sheet), snapshotAt=new Date().toISOString(), started=Date.now(), results=[];
    for(let offset=0;offset<rows.length;offset+=50) {
      if(Date.now()-started>240000) throw new Error('Süre sınırına yaklaşıldı. Önceki kayıtlar güvenle işlendi; sonraki çalıştırmada tekrar kontrol edilir.');
      const payload=JSON.stringify({sourceId,snapshotAt,dryRun,rows:rows.slice(offset,offset+50)});
      if(Utilities.newBlob(payload).getBytes().length>256000) throw new Error('Satır grubu çok büyük; uzun notları kısaltın.');
      let response;
      try { response=UrlFetchApp.fetch(NIBA_ENDPOINT,{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+secret},payload,followRedirects:false,muteHttpExceptions:true}); }
      catch (_) { throw new Error('Aktarım sunucusuna ulaşılamadı. Sonraki çalıştırmada güvenle tekrar deneyin.'); }
      if(response.getResponseCode()!==200) throw new Error('Aktarım durdu. HTTP '+response.getResponseCode()+'. Ayarları ve sunucuyu kontrol edin; anahtarı paylaşmayın.');
      const body=JSON.parse(response.getContentText());
      if(!body.success||!Array.isArray(body.results)) throw new Error('Beklenmeyen sunucu yanıtı.');
      results.push.apply(results,body.results);
    }
    const counts={};results.forEach(r=>{counts[r.status]=(counts[r.status]||0)+1;});
    // Only counts and row numbers are retained; never log keys, customer details or request payloads.
    const summary={at:new Date().toISOString(),dryRun,total:rows.length,counts,issues:results.filter(r=>!['inserted','updated','unchanged'].includes(r.status)).map(r=>({rowNumber:r.rowNumber,status:r.status,message:r.message})).slice(0,40)};
    properties.setProperty('LAST_SYNC_SUMMARY',JSON.stringify(summary));
    console.log(JSON.stringify(summary));
    return summary;
  } finally { lock.releaseLock(); }
}
function denemeAktarimi() { return nRun(true); }
function siparisleriAktar() { return nRun(false); }
function zamanlamayiKur() {
  const p=PropertiesService.getScriptProperties();
  if(p.getProperty('DRY_RUN')!=='false') throw new Error('Önce deneme aktarımını doğrulayın, sonra DRY_RUN=false yapın.');
  zamanlamayiDurdur();
  [12,20].forEach(hour=>ScriptApp.newTrigger('siparisleriAktar').timeBased().atHour(hour).nearMinute(0).everyDays(1).inTimezone('Europe/Istanbul').create());
}
function zamanlamayiDurdur() {
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='siparisleriAktar').forEach(t=>ScriptApp.deleteTrigger(t));
}
