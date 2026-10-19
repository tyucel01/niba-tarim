/* Niba Tarım aktarımı. Anahtarı BURAYA yazmayın; Script Properties kullanın.
 * Ayrı, yalnızca sizin eriştiğiniz bir Apps Script projesine ekleyin.
 * Sipariş aktarır; panelden kesilmiş faturaların durumunu yalnızca AH sütununa yazar.
 * Yeni fatura oluşturmaz. Deneme aktarımında hiçbir Sheet hücresi değiştirilmez.
 */
const NIBA_SYNC_START_DATE = '2023-09-14'; // Sabit başlangıç: satış tarihi bu gün ve sonrası.
const NIBA_HEADER_ROW = 2; // Başlıklar 2. satırda, veriler 3. satırda başlar.
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
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 2958466) return new Date(Date.UTC(1899,11,30) + Math.floor(value)*86400000).toISOString().slice(0,10);
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
    // Araç takip metnini Sheet'te korur; numaralı yolda durumunu panele kısmi sevk olarak gönderir.
    if(/^\d+yolda$/.test(key)) return 'Kısmi Sevk';
    if(['evet','sevkedildi','yapildi','true','1'].includes(key)) return 'Sevk Edildi';
    if(['tamam','tamamlandi'].includes(key)) return 'Tamamlandı';
    if(['hayir','yok','bekliyor','false','0'].includes(key)) return 'Bekliyor';
    if(key==='kismisevk') return 'Kısmi Sevk';
    if(key==='iptal') return 'İptal';
  }
  return String(value).trim(); // Unknown values are rejected by the server, never guessed.
}
function nReadRows(matrix, headerRow = NIBA_HEADER_ROW) {
  matrix = matrix.slice(headerRow - 1);
  if(matrix.length<2) return [];
  const headers = matrix[0].map(nNormalize), mapping = {};
  Object.keys(NIBA_COLUMNS).forEach(field => {
    const aliases = NIBA_COLUMNS[field].map(nNormalize);
    const indexes = headers.map((h,i)=>aliases.includes(h)?i:-1).filter(i=>i>=0);
    if(indexes.length>1) throw new Error('Birden fazla eşleşen sütun: '+field);
    if(indexes.length) mapping[field]=indexes[0];
  });
  ['satisId','satisTarihi','bayi','urun','siparisTonaj','pesinSatisFiyati'].forEach(field=>{if(mapping[field]===undefined) throw new Error('Zorunlu sütun yok: '+NIBA_COLUMNS[field][0]);});
  const rows=[], seen=new Map(), tz='Europe/Istanbul';
  matrix.slice(1).forEach((cells,index)=>{
    const values={};
    Object.keys(mapping).forEach(field=>{
      let value=cells[mapping[field]];
      if(value===''||value===null||value===undefined) return;
      if(field==='satisTarihi'||field==='vadeTarihi') value=nDate(value,tz);
      else if(field==='sevkDurumu'||field==='gts') value=nStatus(field,value);
      else if(!['alisFiyati','pesinSatisFiyati','siparisTonaj','teslimOlanTonaj','vadeFarki','nakliye'].includes(field)) value=String(value).trim();
      values[field]=value;
    });
    // Dahil/Hariç is a delivery condition, not a cost.
    if (typeof values.nakliye === 'string') {
      const condition=nNormalize(values.nakliye);
      if (condition==='dahil'||condition==='haric') {
        const label='Nakliye: '+(condition==='dahil'?'Dahil':'Hariç');
        const note=String(values.not||'').trim();
        values.not=note.split('\n').some(line=>line.trim()===label)?note:[note,label].filter(Boolean).join('\n');
        delete values.nakliye;
      }
    }
    if(!Object.keys(values).length) return;
    // Historical and undated rows are reported by the date filter, never sent.
    if(!nEligibleDate(values.satisTarihi)) { rows.push({rowNumber:index+headerRow+1,values}); return; }
    const id=String(values.satisId||'').trim();
    if(!id) throw new Error('Satır '+(index+headerRow+1)+': Satış ID boş. Hiçbir satır gönderilmedi.');
    if(seen.has(id)) throw new Error('Satır '+seen.get(id)+' ve '+(index+headerRow+1)+': Aynı Satış ID. Hiçbir satır gönderilmedi.');
    seen.set(id,index+headerRow+1); rows.push({rowNumber:index+headerRow+1,values});
  });
  return rows;
}
function nLoadRows(spreadsheetId, sheetName) {
  if (typeof Sheets === 'undefined') throw new Error('Google Sheets API hizmetini ekleyin veya güncel appsscript.json dosyasını kaydedin.');
  // Sheets API values.get supports spreadsheets.readonly; SpreadsheetApp.openById does not.
  const range="'"+sheetName.replace(/'/g,"''")+"'";
  let response;
  try {
    response=Sheets.Spreadsheets.Values.get(spreadsheetId,range,{majorDimension:'ROWS',valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'});
  } catch (_) {
    throw new Error('Tablo okunamadı. Google Sheets API hizmetini, dosyaya erişimi, SPREADSHEET_ID ve SHEET_NAME ayarlarını kontrol edin.');
  }
  return nReadRows(response.values || []);
}
function nRunCore(forceDryRun, referenceOnly = false) {

    const properties=PropertiesService.getScriptProperties();
    const secret=properties.getProperty('SHEETS_SYNC_SECRET');
    const sourceId=properties.getProperty('SHEETS_SYNC_SOURCE_ID');
    const spreadsheetId=properties.getProperty('SPREADSHEET_ID');
    const sheetName=properties.getProperty('SHEET_NAME');
    if(!secret||secret.length<32||!sourceId||!spreadsheetId||!sheetName) throw new Error('Script Properties ayarları eksik.');
    const dryRun=referenceOnly || forceDryRun || properties.getProperty('DRY_RUN')!=='false';
    const started=Date.now(), allRows=nLoadRows(spreadsheetId,sheetName);
    const scope=nDateScope(allRows), rows=referenceOnly?scope.rows:scope.rows.slice().reverse();
    const progressKey=referenceOnly?'NIBA_PROGRESS_REFERENCE_V3':dryRun?'NIBA_PROGRESS_DRY_V5':'NIBA_PROGRESS_LIVE_V5';
    // Keep the cursor across value edits. New rows start a new pass from the latest rows.
    const fingerprint=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      JSON.stringify([NIBA_SYNC_START_DATE,sourceId,spreadsheetId,sheetName,rows.map(row=>String(row.values.satisId))]),Utilities.Charset.UTF_8).join(',');
    let progress;
    try { progress=JSON.parse(properties.getProperty(progressKey)||'null'); } catch (_) {}
    if(!progress||progress.fingerprint!==fingerprint||!Number.isInteger(progress.offset)||progress.offset<0||progress.offset>rows.length) {
      progress={fingerprint,offset:0,counts:{},issues:[],reasons:{},fields:{}};
    }
    const resumedFrom=progress.offset;
    for(let offset=progress.offset;offset<rows.length;offset+=25) {
      // Leave time for the last request and checkpoint; process at most 200 rows per run.
      if(Date.now()-started>45000||offset-resumedFrom>=200) break;
      const batch=rows.slice(offset,offset+25);
      const payload=JSON.stringify({sourceId,snapshotAt:new Date().toISOString(),dryRun,rows:batch});
      if(Utilities.newBlob(payload).getBytes().length>256000) throw new Error('Satır grubu çok büyük; uzun notları kısaltın.');
      let response;
      try { response=UrlFetchApp.fetch(NIBA_ENDPOINT,{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+secret},payload,followRedirects:false,muteHttpExceptions:true}); }
      catch (_) { throw new Error('Aktarım sunucusuna ulaşılamadı. Sonraki çalıştırmada güvenle tekrar deneyin.'); }
      if(response.getResponseCode()!==200) throw new Error('Aktarım durdu. HTTP '+response.getResponseCode()+'. Ayarları ve sunucuyu kontrol edin; anahtarı paylaşmayın.');
      const body=JSON.parse(response.getContentText());
      if(!body.success||!Array.isArray(body.results)) throw new Error('Beklenmeyen sunucu yanıtı.');
      if(body.dryRun!==dryRun||body.results.length!==batch.length||body.results.some((r,i)=>
        r.rowNumber!==batch[i].rowNumber||!['inserted','updated','unchanged','invalid','conflict','review','stale'].includes(r.status))) {
        throw new Error('Eksik veya beklenmeyen sunucu yanıtı. Bu grup sonraki çalıştırmada tekrar kontrol edilecek.');
      }
      body.results.forEach(r=>{
        progress.counts[r.status]=(progress.counts[r.status]||0)+1;
        if(!['inserted','updated','unchanged'].includes(r.status)) {
          const detail=nSafeIssue(r,batch.find(row=>row.rowNumber===r.rowNumber).values);
          detail.alanlar.forEach(field=>{progress.fields[field]=(progress.fields[field]||0)+1;});
          const reason=r.status+': '+detail.neden;
          progress.reasons[reason]=(progress.reasons[reason]||0)+1;
          if(progress.issues.filter(issue=>issue.status===r.status).length<4) progress.issues.push(detail);
        }
      });
      if(!dryRun || referenceOnly) nQueueBatchReports(body.results,batch,referenceOnly);
      progress.offset=offset+batch.length;
      properties.setProperty(progressKey,JSON.stringify(progress));
    }
    const complete=progress.offset===rows.length;
    const summary={at:new Date().toISOString(),dryRun,startDate:NIBA_SYNC_START_DATE,sheetTotal:allRows.length,excludedBeforeStart:scope.old,excludedMissingOrInvalidDate:scope.invalid,dateIssueRows:scope.examples,total:rows.length,
      processed:progress.offset,remaining:rows.length-progress.offset,complete,
      thisRun:progress.offset-resumedFrom,counts:progress.counts,reasons:progress.reasons,fields:progress.fields,issues:progress.issues,
      bilgi:complete?'Kontrol tamamlandı.':dryRun&&!referenceOnly?'Deneme tamamlanmadı; aynı işlevle devam edebilirsiniz.':'Otomatik devam planlanacak; yeniden başlatmayın.'};
    if(complete) properties.deleteProperty(progressKey);
    properties.setProperty(referenceOnly?'LAST_REFERENCE_SUMMARY':'LAST_SYNC_SUMMARY',JSON.stringify(summary));
    console.log(JSON.stringify(summary));
    return summary;

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

// Teşhis: sadece Sheets okur. Panel adresine veri göndermez, anahtarı okumaz.
function nNumberProblem(value) {
  if(value === '' || value === null || value === undefined) return '';
  if(typeof value === 'number') return Number.isFinite(value) && value >= 0 && value <= 1e12 ? '' : 'Negatif veya aralık dışı sayı';
  if(typeof value !== 'string') return 'Sayı yerine '+typeof value;
  let str=value.trim().replace(/\s|₺|TL/gi,'');
  if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) str=str.replace(/\./g,'');
  else if(!/^\d+(?:[.,]\d+)?$/.test(str)) return 'Sayısal biçim tanınmadı';
  const n=Number(str.replace(',','.'));
  return Number.isFinite(n) && n>=0 && n<=1e12 ? '' : 'Sayı aralık dışında';
}
function nNumberReport(rows) {
  const counts={}, examples=[];
  const fields=['alisFiyati','pesinSatisFiyati','siparisTonaj','teslimOlanTonaj','vadeFarki','nakliye'];
  rows.forEach(row=>fields.forEach(field=>{
    const value=row.values[field], problem=nNumberProblem(value);
    if(!problem) return;
    const column=NIBA_COLUMNS[field][0]; counts[column]=(counts[column]||0)+1;
    if(examples.length<12) examples.push({satir:row.rowNumber,sutun:column,neden:problem,
      bicim:String(value).replace(/[0-9]+/g,'#').replace(/[^#.,%+\-()/₺$€\s]/g,'x').replace(/x+/g,'x').slice(0,60)});
  }));
  return {kontrol:'Yalnızca okuma; panele gönderim yok',toplamSatir:rows.length,sorunluSutunlar:counts,ornekler:examples};
}
function sayiKontrolu() {
  const p=PropertiesService.getScriptProperties();
  const spreadsheetId=p.getProperty('SPREADSHEET_ID'), sheetName=p.getProperty('SHEET_NAME');
  if(!spreadsheetId||!sheetName) throw new Error('Dosya ve sekme ayarları eksik.');
  const report=nNumberReport(nLoadRows(spreadsheetId,sheetName));
  console.log(JSON.stringify(report));
  return report;
}

// Only fixed descriptions and known column names may enter diagnostic logs.
function nSafeIssue(result,values) {
  const labels={review:'Faturalı siparişin ticari alanları farklı',conflict:'Kayıt eşleşmesi veya panel değişikliği çakışması',invalid:'Eksik veya geçersiz veri',stale:'Daha yeni aktarım mevcut'};
  const messages={
    'Panelde aynı Satış ID birden fazla kez var.':'Panelde aynı Satış ID birden fazla',
    'Eşleşen sipariş silinmiş veya numarası değiştirilmiş.':'Eşleşen sipariş silinmiş veya numarası değişmiş',
    'Panelde ayrıca değiştirilen alan var; kontrol gerekli.':'Panelde ayrıca değiştirilmiş alan var',
    'Yeni siparişte bayi, ürün, pozitif tonaj ve satış fiyatı zorunlu.':'Yeni siparişte zorunlu alan eksik veya tutar/tonaj sıfır',
    'Sayı biçimi geçersiz.':'Sayı biçimi geçersiz',
    'Sayı aralık dışında.':'Sayı aralık dışında',
    'Metin biçimi geçersiz.':'Metin türü veya uzunluğu geçersiz',
    'Tarih YYYY-MM-DD biçiminde olmalı.':'Tarih biçimi geçersiz',
    'Sevk durumu tanınmıyor.':'Sevk durumu tanınmıyor',
    'GTS durumu tanınmıyor.':'GTS durumu tanınmıyor'
  };
  let fields=Array.isArray(result.fields)?result.fields.filter(f=>Object.prototype.hasOwnProperty.call(NIBA_COLUMNS,f)):[];
  if(result.status==='invalid') {
    Object.keys(values).forEach(field=>{
      const v=values[field];
      if(['alisFiyati','pesinSatisFiyati','siparisTonaj','teslimOlanTonaj','vadeFarki','nakliye'].includes(field)) {
        if(nNumberProblem(v)) fields.push(field);
      } else if(typeof v!=='string'||v.length>(field==='not'?2000:250)) fields.push(field);
      else if(['satisTarihi','vadeTarihi'].includes(field)&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)) fields.push(field);
    });
    if(values.sevkDurumu&&!['Bekliyor','Kısmi Sevk','Sevk Edildi','Tamamlandı','İptal'].includes(values.sevkDurumu)) fields.push('sevkDurumu');
    if(values.gts&&!['Yok','Bekliyor','Girildi'].includes(values.gts)) fields.push('gts');
    if(!values.satisId||String(values.satisId).length>100) fields.push('satisId');
    if(result.message==='Yeni siparişte bayi, ürün, pozitif tonaj ve satış fiyatı zorunlu.') {
      ['bayi','urun','siparisTonaj','pesinSatisFiyati'].forEach(f=>{
        if(!values[f]||(['siparisTonaj','pesinSatisFiyati'].includes(f)&&/^0+(?:[.,]0+)?$/.test(String(values[f]).trim()))) fields.push(f);
      });
    }
  }
  return {rowNumber:result.rowNumber,status:result.status,neden:messages[result.message]||labels[result.status]||'Kontrol gerekli',alanlar:[...new Set(fields)].map(f=>NIBA_COLUMNS[f][0])};
}

function nValidIsoDate(value) {
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
}
function nEligibleDate(value) { return nValidIsoDate(value)&&value>=NIBA_SYNC_START_DATE; }
function nDateScope(allRows) {
  const scope={rows:[],old:0,invalid:0,examples:[]};
  allRows.forEach(row=>{
    const date=row.values.satisTarihi;
    if(!nValidIsoDate(date)) {
      scope.invalid++;
      if(scope.examples.length<10) scope.examples.push(row.rowNumber);
    } else if(date<NIBA_SYNC_START_DATE) scope.old++;
    else scope.rows.push(row);
  });
  return scope;
}

const NIBA_REPORT_EMAIL='info@nibatarim.com';
function nBatchReport(results,batch) {
  const lines=[];
  results.forEach(result=>{
    if(result.status==='unchanged') return;
    const row=batch.find(r=>r.rowNumber===result.rowNumber);
    const id=String(row.values.satisId).replace(/[\r\n]/g,' ');
    const prefix='Satış ID: '+id+' | Sheet satırı: '+row.rowNumber;
    if(result.status==='inserted') lines.push(prefix+' — Yeni sipariş oluşturuldu.');
    else if(result.status==='updated') {
      lines.push(prefix+' — Sipariş güncellendi.');
      const changes=Array.isArray(result.changes)?result.changes:[];
      const known=changes.filter(c=>Object.prototype.hasOwnProperty.call(NIBA_COLUMNS,c.field));
      if(!known.length) lines.push('  Sipariş panele aktarıldı; alan ayrıntısı sunucudan gelmedi.');
      known.forEach(c=>lines.push('  '+NIBA_COLUMNS[c.field][0]+': '+nMailValue(c.before)+' → '+nMailValue(c.after)));
      const protectedFields=(result.reviewFields||[]).filter(field=>Object.prototype.hasOwnProperty.call(NIBA_COLUMNS,field));
      if(protectedFields.length) lines.push('  Faturalı kayıtta korunan alanlar: '+protectedFields.map(field=>NIBA_COLUMNS[field][0]).join(', '));
    } else {
      const issue=nSafeIssue(result,row.values);
      const label=result.status==='review'?'Kontrol gerekli; faturalı kayıt değiştirilmedi: ':result.status==='conflict'?'Eşleşme kontrolü gerekli; kayıt değiştirilmedi: ':'Aktarılamadı: ';
      lines.push(prefix+' — '+label+issue.neden+(issue.alanlar.length?' | Alanlar: '+issue.alanlar.join(', '):''));
    }
  });
  return lines.join('\n');
}
function nMailValue(value) {
  if(value===null||value===undefined||value==='') return '(boş)';
  return String(value).replace(/[\r\n]+/g,' ');
}
// Per-sale notification memory survives completed transfer passes.
// Only hashes are retained; row positions and report timestamps do not create new events.
function nNoticeKey(id) {
  const p=PropertiesService.getScriptProperties();
  return 'NIBA_NOTICE_V1_'+nReportId(JSON.stringify([p.getProperty('SHEETS_SYNC_SOURCE_ID'),p.getProperty('SPREADSHEET_ID'),p.getProperty('SHEET_NAME'),id]));
}
function nStableNotice(value) {
  if(Array.isArray(value)) return value.map(nStableNotice);
  if(value&&typeof value==='object') {
    const out={};Object.keys(value).sort().forEach(key=>out[key]=nStableNotice(value[key]));return out;
  }
  return value;
}
function nSameNoticeValue(before,after) {
  if(before===after) return true;
  if((before===null||before==='')&&(after===null||after==='')) return true;
  // Database numeric values and equivalent text formatting are the same change.
  if(typeof before==='number'&&typeof after==='string'&&!nNumberProblem(after)) {
    let text=after.trim().replace(/\s|₺|TL/gi,'');
    if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text=text.replace(/\./g,'');
    return before===Number(text.replace(',','.'));
  }
  return false;
}
function nQueueBatchReports(results,batch,referenceOnly = false) {
  const p=PropertiesService.getScriptProperties(),saved=p.getProperties(),updates={},reports=[];
  results.forEach(result=>{
    const row=batch.find(item=>item.rowNumber===result.rowNumber);
    if(!row||!row.values||!row.values.satisId) return;
    const key=nNoticeKey(String(row.values.satisId));
    if(referenceOnly && (saved[key] || ['inserted','updated'].includes(result.status))) return;
    if(result.status==='unchanged') {updates[key]='ok';return;}
    const event={...result};
    if(result.status==='updated'&&Array.isArray(result.changes)) {
      event.changes=result.changes.filter(change=>Object.prototype.hasOwnProperty.call(NIBA_COLUMNS,change.field)&&!nSameNoticeValue(change.before,change.after));
      if(result.changes.length && !event.changes.length && result.changes.every(change=>Object.prototype.hasOwnProperty.call(NIBA_COLUMNS,change.field))) {updates[key]='ok';return;}
    }
    const fields=Array.isArray(event.fields)?[...new Set(event.fields)].sort():[];
    const relevantValues=event.status==='review'&&fields.length
      ? Object.fromEntries(fields.filter(field=>Object.prototype.hasOwnProperty.call(NIBA_COLUMNS,field)).map(field=>[field,row.values[field]]))
      : row.values;
    const signature=nReportId(JSON.stringify(nStableNotice({status:event.status,message:event.message||'',fields,changes:event.changes||[],values:relevantValues})));
    if(saved[key]===signature) return;
    const report=nBatchReport([event],[row]);
    if(!report) return;
    reports.push(report);updates[key]=signature;
  });
  // Queue content and its notification memory together; failed queuing is retryable.
  nQueueMail(reports.join('\n'),updates,false,referenceOnly);
}
// Pending reports remain private and keep their original retry IDs until acknowledged.
function nQueueMail(body,noticeUpdates,force,rememberOnly = false) {
  const p=PropertiesService.getScriptProperties(),parts={...(noticeUpdates||{})};
  if(!body||rememberOnly) {if(Object.keys(parts).length)p.setProperties(parts);return;}
  if(!noticeUpdates&&!force) {
    const key=nNoticeKey('__sync_error__'),signature=nReportId(body);
    if(p.getProperty(key)===signature) return;
    parts[key]=signature;
  }
  const stamp=Date.now()+'_'+Utilities.getUuid();
  for(let i=0;i<body.length;i+=1500) parts['NIBA_MAIL_'+stamp+'_'+String(i/1500).padStart(4,'0')]=body.slice(i,i+1500);
  p.setProperties(parts);
}
function nReportId(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8)
    .map(b=>((b+256)%256).toString(16).padStart(2,'0')).join('');
}
function nFlushMail() {
  const p=PropertiesService.getScriptProperties(), values=p.getProperties();
  const keys=Object.keys(values).filter(k=>k.startsWith('NIBA_MAIL_')).sort();
  if(!keys.length) return;
  const secret=p.getProperty('REPORT_SECRET');
  if(!secret||secret.length<32) throw new Error('REPORT_SECRET eksik. Rapor saklandı; anahtarı paylaşmayın.');
  const groups={};
  keys.forEach(k=>{const group=k.slice(0,k.lastIndexOf('_'));if(!groups[group]) groups[group]={text:'',keys:[]};groups[group].text+=values[k];groups[group].keys.push(k);});
  for(const group of Object.keys(groups)) {
    const report=groups[group].text;
    for(let i=0;i<report.length;i+=40000) {
      const text=report.slice(i,i+40000);
      const payload=JSON.stringify({id:nReportId(group+'|'+i+'|'+text),text});
      let response;
      try {response=UrlFetchApp.fetch('https://rapor.nibatarim.com/report',{
        method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+secret},
        payload,followRedirects:false,muteHttpExceptions:true});}
      catch (_) {throw new Error('Rapor sunucusuna ulaşılamadı. Rapor saklandı; sonraki çalıştırmada tekrar denenecek.');}
      let accepted=false;
      try {accepted=response.getResponseCode()===200&&JSON.parse(response.getContentText()).success===true;} catch (_) {}
      if(!accepted) throw new Error('Rapor gönderilemedi. Rapor saklandı; sonraki çalıştırmada tekrar denenecek.');
    }
    groups[group].keys.forEach(k=>p.deleteProperty(k));
  }
}
function nRun(forceDryRun) {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) {
    console.log('Başka bir aktarım çalışıyor. Normal aktarım yaklaşık 1 dakika sonra tekrar denenecek.');
    if(!forceDryRun) nNormalDevamiPlanla();
    return {complete:false,bilgi:'Başka bir aktarım çalışıyor; devam planlandı.'};
  }
  const live=!forceDryRun&&PropertiesService.getScriptProperties().getProperty('DRY_RUN')==='false';
  try {
    if(live) nNormalDevamTemizle();
    // A mail outage must not prevent Sheet changes from reaching the panel.
    if(live) nGuvenliMailGonder();
    let summary;
    try { summary=nRunCore(forceDryRun); if(live) PropertiesService.getScriptProperties().deleteProperty(nNoticeKey('__sync_error__')); }
    catch (error) {
      if(live) {
        nQueueMail('Aktarım tamamlanamadı. Bazı kayıtlar işlenmiş olabilir. Apps Script yürütme kaydını kontrol edin; aynı aktarım tekrar denenebilir.');
        nGuvenliMailGonder();
      }
      throw error;
    }
    // Refresh AH once after the complete order pass, not once per 200-row page.
    if(summary.complete) try {
      summary.fatura=nInvoiceStatuses(!live);
      PropertiesService.getScriptProperties().setProperty('LAST_SYNC_SUMMARY',JSON.stringify(summary));
    } catch (_) {
      summary.fatura={hata:'AH fatura durumu güncellenemedi; sonraki aktarımda tekrar denenecek.'};
      PropertiesService.getScriptProperties().setProperty('LAST_SYNC_SUMMARY',JSON.stringify(summary));
      console.log('AH fatura durumu güncellenemedi. Sheet yazma iznini, AH başlığını ve panel yayınının tamamlandığını kontrol edin.');
    }
    if(live) {
      if(!summary.complete) nNormalDevamiPlanla();
      nGuvenliMailGonder();
    }
    return summary;
  } finally { lock.releaseLock(); }
}
function epostaTesti() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) throw new Error('Başka bir aktarım çalışıyor.');
  try {
    nQueueMail('Niba Tarım — E-posta raporu testi. Bu test sipariş veya Sheet kaydı değiştirmez.',null,true);
    nFlushMail();
    console.log('Test raporu gönderim sunucusu tarafından kabul edildi.');
  } finally {lock.releaseLock();}
}


// Invoice status sync only writes AH, using the current position of each unique Sales ID.
const NIBA_INVOICE_STATUS_ENDPOINT='https://www.nibatarim.com/api/integrations/sheets/invoice-status';
function nInvoiceSheet(matrix) {
  const headers=(matrix[NIBA_HEADER_ROW-1]||[]).map(nNormalize);
  const aliases=NIBA_COLUMNS.satisId.map(nNormalize);
  const indexes=headers.map((header,index)=>aliases.includes(header)?index:-1).filter(index=>index>=0);
  if(indexes.length!==1) throw new Error('Satış ID sütunu tek olmalı.');
  if(!['fatura','faturadurumu','faturakesildi'].includes(headers[33])) throw new Error('AH sütununun başlığı Fatura olmalı. Başka sütuna yazılmadı.');
  const byId=Object.create(null);
  matrix.slice(NIBA_HEADER_ROW).forEach((cells,index)=>{
    const id=String(cells[indexes[0]]==null?'':cells[indexes[0]]).trim();
    if(!id) return;
    if(!byId[id]) byId[id]=[];
    byId[id].push({rowNumber:index+NIBA_HEADER_ROW+1,value:cells[33]});
  });
  return byId;
}
function nInvoiceWritePlan(statuses,matrix,formulaRows,sheetName) {
  const byId=nInvoiceSheet(matrix), seen=new Set(), data=[], counts={guncellenecek:0,ayni:0,tekrarlananId:0,formul:0,bulunamadi:0};
  statuses.forEach(item=>{
    if(!item||typeof item.satisId!=='string'||seen.has(item.satisId)||![null,'Evet','Kısmi Evet'].includes(item.status)) throw new Error('Fatura durumu yanıtı geçersiz.');
    seen.add(item.satisId);
    if(item.status===null) return; // Pending/unissued invoices do not erase manual cells.
    const matches=byId[item.satisId]||[];
    if(matches.length!==1) {counts[matches.length?'tekrarlananId':'bulunamadi']++;return;}
    const row=matches[0], formula=formulaRows[row.rowNumber-1];
    if(formula&&String(formula[0]||'').startsWith('=')) {counts.formul++;return;}
    if(String(row.value||'').trim()===item.status) {counts.ayni++;return;}
    data.push({range:"'"+sheetName.replace(/'/g,"''")+"'!AH"+row.rowNumber,values:[[item.status]]});
    counts.guncellenecek++;
  });
  return {data,counts};
}
function nInvoiceStatuses(dryRun) {
  const p=PropertiesService.getScriptProperties(), secret=p.getProperty('SHEETS_SYNC_SECRET'), sourceId=p.getProperty('SHEETS_SYNC_SOURCE_ID');
  const spreadsheetId=p.getProperty('SPREADSHEET_ID'),sheetName=p.getProperty('SHEET_NAME');
  if(!secret||secret.length<32||!sourceId||!spreadsheetId||!sheetName) throw new Error('Script Properties ayarları eksik.');
  const rows=nDateScope(nLoadRows(spreadsheetId,sheetName)).rows;
  const ids=rows.map(row=>String(row.values.satisId||'').trim());
  if(ids.some(id=>!id)||new Set(ids).size!==ids.length) throw new Error('Satış ID boş veya tekrarlanmış.');
  const statuses=[],started=Date.now();
  for(let offset=0;offset<ids.length;offset+=100) {
    if(Date.now()-started>90000) throw new Error('Fatura sorgusu süre sınırına yaklaştı.');
    const batch=ids.slice(offset,offset+100);
    const response=UrlFetchApp.fetch(NIBA_INVOICE_STATUS_ENDPOINT,{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+secret},payload:JSON.stringify({sourceId,satisIds:batch}),followRedirects:false,muteHttpExceptions:true});
    if(response.getResponseCode()!==200) throw new Error('Fatura durumları alınamadı.');
    const body=JSON.parse(response.getContentText());
    if(!body.success||!Array.isArray(body.statuses)||body.statuses.length!==batch.length||body.statuses.some((item,index)=>item.satisId!==batch[index])) throw new Error('Fatura yanıtı eksik veya geçersiz.');
    statuses.push.apply(statuses,body.statuses);
  }
  // Re-read after network calls so sorted/moved rows are located by ID, never stale row numbers.
  const range="'"+sheetName.replace(/'/g,"''")+"'";
  const current=Sheets.Spreadsheets.Values.get(spreadsheetId,range,{majorDimension:'ROWS',valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'}).values||[];
  const formulas=Sheets.Spreadsheets.Values.get(spreadsheetId,range+'!AH:AH',{majorDimension:'ROWS',valueRenderOption:'FORMULA'}).values||[];
  const plan=nInvoiceWritePlan(statuses,current,formulas,sheetName);
  if(!dryRun&&plan.data.length) {
    const result=Sheets.Spreadsheets.Values.batchUpdate({valueInputOption:'RAW',data:plan.data},spreadsheetId);
    if(Number(result.totalUpdatedCells)!==plan.data.length) throw new Error('AH güncellemesi tam doğrulanamadı. Sonraki aktarımda tekrar denenecek.');
  }
  return {dryRun,guncellenen:dryRun?0:plan.data.length,...plan.counts};
}
function faturaDurumlariDeneme() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) throw new Error('Başka bir aktarım çalışıyor.');
  try {const summary=nInvoiceStatuses(true);console.log(JSON.stringify(summary));return summary;} finally {lock.releaseLock();}
}

// Normal sync and optional reference use separate cursors and never mute each other.
function nNormalDevamTemizle() {
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='nSiparisAktarimiDevam').forEach(t=>ScriptApp.deleteTrigger(t));
}
function nNormalDevamiPlanla() {
  nNormalDevamTemizle();
  ScriptApp.newTrigger('nSiparisAktarimiDevam').timeBased().after(60000).create();
  console.log('Normal aktarım yaklaşık 1 dakika sonra kaldığı yerden devam edecek.');
}
function nSiparisAktarimiDevam() { return nRun(false); }
function nGuvenliMailGonder() {
  try {nFlushMail();} catch(_) {console.log('E-posta raporu gönderilemedi; kuyruk korundu. Sipariş aktarımı devam ediyor.');}
}
function nReferansTetikleriniTemizle() {
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='nBildirimReferansiDevam').forEach(t=>ScriptApp.deleteTrigger(t));
}
function nBildirimReferansiDevam() { return mevcutBildirimleriReferansAl(); }
function mevcutBildirimleriReferansAl() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) {console.log('Başka bir aktarım çalışıyor; referans için yeniden deneme planlandı.');nReferansTetikleriniTemizle();ScriptApp.newTrigger('nBildirimReferansiDevam').timeBased().after(60000).create();return {complete:false};}
  const p=PropertiesService.getScriptProperties();
  try {
    nReferansTetikleriniTemizle();
    // Read-only server check. Never writes orders, suppresses normal mail or marks real updates as notified.
    const summary=nRunCore(true,true);
    if(!summary.complete) {
      ScriptApp.newTrigger('nBildirimReferansiDevam').timeBased().after(60000).create();
      console.log('Salt okunur referans: '+summary.processed+' / '+summary.total+'. Otomatik devam edecek. Normal aktarım ve değişiklik bildirimleri açıktır.');
    } else {
      p.deleteProperty('NIBA_NOTICE_BASELINE_V1');
      console.log('Eski farklar bildirim hafızasına alındı. Siparişler değiştirilmedi; normal değişiklik bildirimleri açıktır.');
    }
    return summary;
  } finally {lock.releaseLock();}
}
function aktarimDurumu() {
  const p=PropertiesService.getScriptProperties();
  const parse=key=>{try{return JSON.parse(p.getProperty(key)||'null');}catch(_){return null;}};
  const summary=parse('LAST_SYNC_SUMMARY'),cursor=parse('NIBA_PROGRESS_LIVE_V5');
  const report={sonAktarim:summary,devamNoktasi:cursor?cursor.offset:null,otomatikDevam:ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='nSiparisAktarimiDevam').length};
  console.log(JSON.stringify(report));return report;
}
