export const siteConfig = {
  name: 'Alejandra Mendivelso',
  role: 'Desarrollo de software · UX/UI · Realidad aumentada',
  roleEn: 'Software development · UX/UI · Augmented reality',
  location: 'Sogamoso, Boyacá, Colombia',
  url: 'https://alejandramendivelso.com',
  title: 'Alejandra Mendivelso | Desarrollo, UX/UI y realidad aumentada',
  titleEn: 'Alejandra Mendivelso | Development, UX/UI and augmented reality',
  description:
    'Portafolio de Alejandra Mendivelso, ingeniera multimedia en formación: desarrollo de software, diseño UX/UI y experiencias de realidad aumentada.',
  descriptionEn:
    'Portfolio of Alejandra Mendivelso, multimedia engineering student: software development, UX/UI design and augmented reality experiences.',
  ogImage: '/og-image.png',
  locale: 'es_CO',
  localeEn: 'en_US',
  /** Persistencia */
  storageKeys: {
    themeMode: 'am.theme',
    locale: 'am.locale',
    helpSeen: 'am.helpSeen',
    music: 'am.music',
  },
} as const;

export type SiteConfig = typeof siteConfig;
