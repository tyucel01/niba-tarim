"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type DialogApi = { panelAlert: (message: unknown) => Promise<void>; panelConfirm: (message: unknown) => Promise<boolean> };
const Context = createContext<DialogApi | null>(null);
export function PanelDialogProvider({children}:{children:ReactNode}) {
  const [request,setRequest] = useState<{message:string;confirm:boolean}|null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((accepted:boolean)=>void)|null>(null);
  function finish(accepted:boolean) { const done=resolver.current;resolver.current=null;setRequest(null);done?.(accepted); }
  function show(message:unknown,confirm:boolean) { resolver.current?.(false);return new Promise<boolean>(resolve=>{resolver.current=resolve;setRequest({message:typeof message==='string'?message:JSON.stringify(message),confirm});}); }
  useEffect(()=>{const element=dialog.current;if(request && element && !element.open) element.showModal();else if(!request && element?.open) element.close();},[request]);
  useEffect(()=>()=>{resolver.current?.(false);resolver.current=null;},[]);
  return <Context.Provider value={{panelAlert:async message=>{await show(message,false);},panelConfirm:message=>show(message,true)}}>{children}<dialog ref={dialog} aria-labelledby="panel-dialog-title" onCancel={event=>{event.preventDefault();finish(false);}} className="m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50"><div className="p-6"><h2 id="panel-dialog-title" className="text-xl font-bold">{request?.confirm ? 'İşlemi onayla' : 'İşlem sonucu'}</h2><p className="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{request?.message}</p><div className="mt-6 flex justify-end gap-3">{request?.confirm && <button autoFocus type="button" onClick={()=>finish(false)} className="rounded-xl border border-slate-200 px-5 py-3 font-bold">Vazgeç</button>}<button autoFocus={!request?.confirm} type="button" onClick={()=>finish(true)} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">{request?.confirm ? 'Onayla' : 'Tamam'}</button></div></div></dialog></Context.Provider>;
}
export function usePanelDialog() { const api=useContext(Context);if(!api) throw new Error('Panel dialog provider missing');return api; }
