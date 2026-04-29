import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://nibatarim.com',
      lastModified: new Date(),
    },
    {
      url: 'https://nibatarim.com/blog',
      lastModified: new Date(),
    },
    {
      url: 'https://nibatarim.com/blog/gubre-fiyatlari',
      lastModified: new Date(),
    },
  ]
}