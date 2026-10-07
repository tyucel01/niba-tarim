"use client";

import Link from "next/link";
import PendingInvoices from "./pending-invoices";
import { ArrowDownToLine, ArrowRight, ClipboardList, FileText, LayoutDashboard, LogOut, MessageCircle, Plus, RefreshCw, Send, UserRound, Users, WalletCards, ChartNoAxesCombined, type LucideIcon } from "lucide-react";

export type DashboardStats = { orders: number; users: number; activeCampaigns: number; pendingMessages: number };
type Props = { stats: DashboardStats; statsLoading: boolean; lastUpdated: string; onRefresh: () => void; onLogout: () => void };
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-4";
const shortcuts = [
  { title: "Siparişler", description: "Alış–satış, sevk ve fatura takibi.", href: "/admin/siparisler", icon: ClipboardList, color: "bg-emerald-50 text-emerald-700", action: "Siparişleri aç" },
  { title: "Fiyat formu", description: "Güncel fiyat listesini hazırla ve paylaş.", href: "/admin/fiyat-formu", icon: FileText, color: "bg-amber-50 text-amber-700", action: "Fiyat formunu aç" },
  { title: "WhatsApp", description: "Müşterilerle yazış, toplu mesaj gönder.", href: "/admin/whatsapp/gonder", icon: MessageCircle, color: "bg-sky-50 text-sky-700", action: "WhatsApp’ı aç" },
];
const tools = [
  { title: "Kart çekimleri", description: "Müşteri ve tedarikçi kart işlemleri", href: "/admin/finans/kart-cekimleri", icon: WalletCards },
  { title: "WhatsApp raporları", description: "Gönderim sonuçları ve kampanyalar", href: "/admin/whatsapp/raporlar", icon: ChartNoAxesCombined },
  { title: "Sipariş formu", description: "Müşteri ve bayi için form hazırla", href: "/admin/siparisler/yeni", icon: FileText },
  { title: "Kullanıcılar", description: "Kullanıcı ve erişim yönetimi", href: "/admin/kullanicilar", icon: Users },
];

export default function Dashboard({ stats, statsLoading, lastUpdated, onRefresh, onLogout }: Props) {
  return <main className="min-h-screen bg-[#f5f7f5] text-slate-900 lg:pl-60">
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white px-5 py-7 lg:flex">
      <Link href="/admin" prefetch={false} aria-label="Niba Tarım yönetim paneli" className={`block rounded-xl ${focus}`}><img src="/niba-logo-horizontal.png" alt="Niba Tarım" className="mx-auto h-36 w-full object-contain" /><p className="mt-1 text-center text-xs text-slate-400">Yönetim paneli</p></Link>
      <nav aria-label="Ana menü" className="mt-10 space-y-2">
        <Link href="/admin" aria-current="page" className={`flex min-h-12 items-center gap-3 rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 ${focus}`}><LayoutDashboard size={19} aria-hidden="true" />Genel bakış</Link>
        {shortcuts.map(item => <Link key={item.href} href={item.href} prefetch={false} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 ${focus}`}><item.icon size={19} aria-hidden="true" />{item.title}</Link>)}
      </nav>
      <div className="mt-auto space-y-2 border-t border-slate-100 pt-5"><Link href="/admin/profil" prefetch={false} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm text-slate-500 hover:bg-slate-50 ${focus}`}><UserRound size={19} aria-hidden="true" />Profilim</Link><button onClick={onLogout} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm text-slate-500 hover:bg-red-50 hover:text-red-700 ${focus}`}><LogOut size={19} aria-hidden="true" />Çıkış yap</button></div>
    </aside>
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-7 lg:px-10 lg:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 lg:hidden">Niba Tarım</p><h1 className="mt-1 text-xl font-bold tracking-tight">Genel bakış</h1></div>
        <div className="flex items-center gap-2"><Link href="/admin/profil" prefetch={false} className={`flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium ${focus}`}><UserRound size={17} aria-hidden="true" /><span>Profilim</span></Link><button onClick={onLogout} aria-label="Çıkış yap" className={`flex size-11 items-center justify-center rounded-xl text-slate-500 hover:bg-white lg:hidden ${focus}`}><LogOut size={19} aria-hidden="true" /></button></div>
      </header>
      <PendingInvoices />
      <section className="relative mt-6 overflow-hidden rounded-3xl bg-[#164b3b] p-6 text-white sm:p-8 lg:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-28 size-80 rounded-full border-[40px] border-white/[0.04]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-24 size-64 rounded-full border-[35px] border-white/[0.04]" />
        <div className="relative flex flex-col justify-between gap-7 xl:flex-row xl:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">İşinin başında, her şey elinin altında.</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Kolay gelsin.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-emerald-50/75">Siparişlerini takip et, fiyatlarını paylaş ve müşterilerinle iletişimde kal.</p></div><Link href="/admin/siparisler/yeni-siparis" prefetch={false} className={`inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-900 transition hover:bg-emerald-50 ${focus}`}><Plus size={19} aria-hidden="true" />Yeni sipariş oluştur</Link></div>
      </section>
      <section aria-labelledby="daily-title" className="mt-8">
        <div className="mb-4 flex items-center justify-between"><h2 id="daily-title" className="text-lg font-bold">Günlük işlemler</h2><span className="text-xs text-slate-400">Hızlı erişim</span></div>
        <div className="grid gap-3 md:grid-cols-3 md:gap-4">{shortcuts.map(item => <Link key={item.href} href={item.href} prefetch={false} className={`group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-sm ${focus}`}><div className="flex items-center gap-4 md:block"><span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${item.color}`}><item.icon size={24} strokeWidth={1.7} aria-hidden="true" /></span><div><h3 className="font-bold md:mt-5 md:text-lg">{item.title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p></div></div><span className="mt-5 hidden items-center justify-between text-sm font-semibold text-emerald-800 md:flex">{item.action}<ArrowRight size={17} aria-hidden="true" /></span></Link>)}</div>
      </section>
      <div className="mt-8 grid items-start gap-7 xl:grid-cols-[1.35fr_1fr]">
        <section aria-labelledby="tools-title"><h2 id="tools-title" className="mb-4 text-lg font-bold">Diğer araçlar</h2><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">{tools.map(item => <Link key={item.href} href={item.href} prefetch={false} className={`flex min-h-20 items-center gap-3 border-b border-slate-100 p-4 last:border-0 hover:bg-slate-50 ${focus}`}><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500"><item.icon size={20} strokeWidth={1.6} aria-hidden="true" /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p></div><ArrowRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" /></Link>)}</div></section>
        <section aria-labelledby="stats-title" aria-busy={statsLoading}><div className="mb-4 flex min-h-7 items-center justify-between gap-3"><h2 id="stats-title" className="text-lg font-bold">Panel özeti</h2><button onClick={onRefresh} disabled={statsLoading} aria-label="Panel özetini yenile" className={`-my-2 flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-white disabled:opacity-50 ${focus}`}><RefreshCw size={14} className={statsLoading ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />{statsLoading ? 'Yenileniyor' : 'Yenile'}</button></div>
          <div className="grid grid-cols-2 gap-3"><Stat title="Toplam sipariş" value={stats.orders} loading={statsLoading} icon={ClipboardList} href="/admin/siparisler" /><Stat title="Kullanıcı" value={stats.users} loading={statsLoading} icon={Users} href="/admin/kullanicilar" /><Stat title="Aktif kampanya" value={stats.activeCampaigns} loading={statsLoading} icon={Send} href="/admin/whatsapp/raporlar" /><Stat title="Gönderim kuyruğu" value={stats.pendingMessages} loading={statsLoading} icon={ArrowDownToLine} href="/admin/whatsapp/raporlar" /></div>
          <p className="mt-3 text-xs leading-5 text-slate-400" role="status">{lastUpdated ? `Son güncelleme: ${lastUpdated}` : 'Özet bilgileri yükleniyor.'}</p>
        </section>
      </div>
      <footer className="mt-8 border-t border-slate-200 pt-5 text-xs text-slate-400">Niba Tarım · Yönetim paneli</footer>
    </div>
  </main>;
}

function Stat({ title, value, loading, icon: Icon, href }: { title: string; value: number; loading: boolean; icon: LucideIcon; href: string }) {
  return <Link href={href} prefetch={false} className={`rounded-2xl border border-slate-200 bg-white p-4 hover:border-emerald-300 ${focus}`}><Icon size={18} className="text-slate-400" aria-hidden="true" /><p className="mt-3 text-2xl font-semibold tracking-tight">{loading ? '—' : new Intl.NumberFormat('tr-TR').format(value)}</p><p className="mt-1 text-xs text-slate-500">{title}</p></Link>;
}
