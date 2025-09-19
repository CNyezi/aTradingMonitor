import { SiteConfig } from "@/types/siteConfig";

export const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nexty.dev";

const GITHUB_URL = ''
const TWITTER_URL = ''
const BSKY_URL = ''
const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL
const EMAIL_URL = 'mailto:hi@nexty.dev'

export const siteConfig: SiteConfig = {
  name: "Nexty.dev",
  url: BASE_URL,
  authors: [
    {
      name: "nexty.dev",
      url: BASE_URL,
    }
  ],
  creator: '@judewei_dev',
  socialLinks: {
    github: GITHUB_URL,
    bluesky: BSKY_URL,
    twitter: TWITTER_URL,
    discord: DISCORD_URL,
    email: EMAIL_URL,
  },
  themeColors: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
  defaultNextTheme: 'light', // next-theme option: system | dark | light
  icons: {
    icon: "/favicon.ico",
    shortcut: "/logo.png",
    apple: "/logo.png", // apple-touch-icon.png
  },
}
