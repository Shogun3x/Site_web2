// Config
// ------------
// Description: The configuration file for the website.

export interface Logo {
	src: string
	srcDark: string
	alt: string
}

export type Mode = 'auto' | 'light' | 'dark'

export interface Config {
	siteTitle: string
	siteDescription: string
	ogImage: string
	logo: Logo
	canonical: boolean
	noindex: boolean
	mode: Mode
	scrollAnimations: boolean
}

export const configData: Config = {
	siteTitle:
		'Automatisation et IA pour PME | Services de consultation et développement sur mesure | Québec',
	siteDescription:
		'Optimisez vos processus avec l\'automatisation et l\'IA. Services de consultation et développement sur mesure pour PME à Québec. ROI mesurable, solutions pragmatiques.',
	ogImage: '/og.jpg',
	logo: {
		src: '/logo-light.svg',
		srcDark: '/logo-dark.svg',
		alt: 'Logo'
	},
	canonical: true,
	noindex: false,
	mode: 'light',
	scrollAnimations: true
}
