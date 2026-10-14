export const siteConfig = {
  name: 'Alejandra Mendivelso',
  role: 'Diseñadora visual & Directora de arte',
  location: 'Bogotá, Colombia',
  url: 'https://alejandramendivelso.com',
  title: 'Alejandra Mendivelso — Portafolio',
  description:
    'Portafolio interactivo de Alejandra Mendivelso: diseño visual y dirección de arte en una galería 3D explorable.',
  ogImage: '/og-image.svg',
  twitterHandle: '@alejandram',
  locale: 'es_CO',
  /** Persistencia */
  storageKeys: {
    themeMode: 'am.theme',
    locale: 'am.locale',
    helpSeen: 'am.helpSeen',
  },
} as const;

export type SiteConfig = typeof siteConfig;
