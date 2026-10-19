const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('app/admin/finans/kart-cekimleri/page.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function mount(cache){
 const effects=[],calls=[];let stored=cache,resolveContacts;
 const hooks={useState:value=>[typeof value==='function'?value():value,()=>{}],useRef:value=>({current:value}),useMemo:fn=>fn(),useEffect:fn=>effects.push(fn)};
 const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};const exports={};
 const fetch=async(url)=>{calls.push(url);if(url.includes('/contacts'))return new Promise(resolve=>{resolveContacts=()=>resolve({json:async()=>({ok:true,contacts:[{id:'1',name:'Örnek'}]})});});return {json:async()=>({ok:true,transactions:[]})};};
 vm.runInNewContext(code,{exports,require:name=>name==='react'?hooks:name==='react/jsx-runtime'?jsx:name.includes('panel-dialog')?{usePanelDialog:()=>({panelConfirm:async()=>true})}:{default:()=>null},fetch,localStorage:{getItem:()=>stored,setItem:(_,value)=>{stored=value;}},Date,Promise,JSON,console});
 const tree=exports.default();const walk=node=>!node?[]:Array.isArray(node)?node.flatMap(walk):typeof node==='object'?[node,...walk(node.props?.children)]:[];
 const refresh=walk(tree).find(n=>n.type==='button'&&n.props.children==='Paraşüt carilerini yenile');assert.ok(refresh);
 return {effects,calls,refresh:refresh.props.onClick,resolve:()=>resolveContacts(),stored:()=>stored};
}
(async()=>{
 const oldCache=JSON.stringify({createdAt:1,contacts:[{id:'old',name:'Kayıtlı cari'}]});
 const cached=mount(oldCache);cached.effects[0]();cached.effects[0]();await Promise.resolve();assert.equal(cached.calls.filter(x=>x.includes('/contacts')).length,0,'Eski liste kendiliğinden yenilenmemeli');
 const refreshes=Array.from({length:5},()=>cached.refresh());assert.equal(cached.calls.filter(x=>x.includes('/contacts')).length,1,'Aynı anda yenilemeler tek isteğe birleşmeli');assert.ok(cached.calls.includes('/api/admin/parasut/contacts?refresh=1'));cached.resolve();await Promise.all(refreshes);
 const cold=mount(null);cold.effects[0]();cold.effects[0]();assert.equal(cold.calls.filter(x=>x.includes('/contacts')).length,1,'İlk yüklemede tek cari isteği olmalı');cold.resolve();await new Promise(r=>setTimeout(r,0));assert.ok(cold.stored());
 console.log('Cari listesi: eski önbellek korunuyor, yalnız açık yenileme kaynak listeyi güncelliyor ve eşzamanlı istekler birleştiriliyor.');
})().catch(error=>{console.error(error);process.exitCode=1;});
