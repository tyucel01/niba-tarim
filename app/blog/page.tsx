import {Shell,Intro,Posts,s} from '../_public/site';
import Quote from '../_public/quote';
export const metadata={title:'Tarım Rehberi | Niba Tarım Blog',description:'Gübre, tarımsal girdi tedariği ve fiyat teklifi süreçleri hakkında bilgiler.'};
export default function Blog(){return <Shell><Intro label="Tarım rehberi" title="Bilgiyle güçlenen kararlar." text="Gübre ve tarımsal girdi tedariğinde ihtiyacınızı planlamanıza yardımcı olacak yazılar."/><section className={s.section}><div className={s.container}><Posts/></div></section><Quote/></Shell>}
