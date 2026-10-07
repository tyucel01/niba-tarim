import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/hakkimizda', '/urunler', '/markalar', '/iletisim', '/blog', '/blog/gubre-fiyatlari', '/blog/can-26-gubre-fiyati', '/blog/toptan-gubre-bayiler-icin-tedarik-rehberi'].map(path => ({ url: `https://www.nibatarim.com${path}`, lastModified: new Date('2026-10-07T12:00:00+03:00') }));
}
