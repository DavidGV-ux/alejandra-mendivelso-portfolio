export const siteConfig = {
  name: 'Alejandra Mendivelso',
  role: 'Diseñadora visual & Directora de arte',
  roleEn: 'Visual designer & Art director',
  location: 'Bogotá, Colombia',
  url: 'https://alejandramendivelso.com',
  title: 'Alejandra Mendivelso — Portafolio',
  titleEn: 'Alejandra Mendivelso — Portfolio',
  description:
    'Portafolio interactivo de Alejandra Mendivelso: diseño visual y dirección de arte en una galería 3D explorable.',
  descriptionEn:
    'Interactive portfolio by Alejandra Mendivelso: visual design and art direction in an explorable 3D gallery.',
  ogImage: '/og-image.png',
  twitterHandle: '@alejandram',
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
