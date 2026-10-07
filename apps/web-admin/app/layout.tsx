import type { Metadata, Viewport } from "next";
import { EDU_CSS, Icon, NavLinks, MobileBar, PortalLinks, OfflineNotice, PWAInstallPrompt, type NavItem } from "@edufarm/ui";

const ADMIN_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/verifications", label: "Verifications", icon: "verify" },
  { href: "/reviews", label: "Reviews", icon: "file" },
  { href: "/settlements", label: "Settlement", icon: "wallet" },
  { href: "/disputes", label: "Disputes", icon: "dispute" },
  { href: "/email", label: "Email", icon: "mail" },
  { href: "/onboarding", label: "Onboarding", icon: "school" },
  { href: "/notifications", label: "Alerts", icon: "bell" },
  { href: "/devotionals", label: "Word", icon: "star" },
  { href: "/login", label: "Login", icon: "user" },
];

export const metadata: Metadata = {
  title: "EDUFARM — Admin",
  description: "Platform admin: verification, reviews, settlement, disputes, onboarding.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "EDUFARM Admin" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#101828",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const CSS = EDU_CSS;
const SW = `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})});}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="EDUFARM Admin" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="tone-admin">
        <a className="skip" href="#main">Skip to content</a>
        <h1 className="sr-only">EDUFARM Admin — verification, reviews, settlement and disputes</h1>
        <style>{CSS}</style>
        <OfflineNotice />
        <PWAInstallPrompt appName="EDUFARM Admin" />
        <header className="top">
          <nav aria-label="Admin">
            <span className="brand-chip"><Icon name="shield" size={17} /> EDUFARM · Admin</span>
            <NavLinks items={ADMIN_NAV} />
            <PortalLinks />
          </nav>
        </header>
        <div className="wrap"><main id="main">{children}</main></div>
        <nav className="bottomnav" aria-label="Quick"><MobileBar items={ADMIN_NAV.slice(0, 5)} /></nav>
        <script dangerouslySetInnerHTML={{ __html: SW }} />
      </body>
    </html>
  );
}
