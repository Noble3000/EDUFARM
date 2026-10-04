import type { Metadata, Viewport } from "next";
import { EDU_CSS, Icon, NavLinks, MobileBar, PortalLinks, type NavItem } from "@edufarm/ui";

const LECTURER_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/login", label: "Login", icon: "user" },
  { href: "/signup", label: "Signup", icon: "plus" },
];
export const metadata: Metadata = {
  title: "EDUFARM — Lecturer",
  description: "Lecturer console: courses, materials, assessments, Q&A, insights and earnings.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "EDUFARM Teach" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#0A4230", width: "device-width", initialScale: 1, viewportFit: "cover" };
// Shared EDU_CSS language (packages/ui) — lecturer tone: solid header, restrained.
// Same geometry as student/admin; professionalism via color, not a new language.
const CSS = EDU_CSS;
const SW = `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})});}`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><head><meta name="mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-capable" content="yes" /><link rel="apple-touch-icon" href="/icons/icon.svg" /></head><body className="tone-lecturer"><a className="skip" href="#main">Skip to content</a><style>{CSS}</style>
      <header className="top"><nav aria-label="Lecturer"><span className="brand-chip"><Icon name="grad" size={17} /> EDUFARM · Lecturer</span><NavLinks items={LECTURER_NAV} /><PortalLinks /></nav></header>
      <div className="wrap"><main id="main">{children}</main></div>
      <nav className="bottomnav" aria-label="Quick"><MobileBar items={LECTURER_NAV} /></nav>
      <script dangerouslySetInnerHTML={{ __html: SW }} />
    </body></html>
  );
}
