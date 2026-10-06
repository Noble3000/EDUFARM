import type { Metadata, Viewport } from "next";
import { EDU_CSS, Icon, NavLinks, MobileBar, PortalLinks, type NavItem } from "@edufarm/ui";

const STUDENT_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/courses", label: "Courses", icon: "book" },
  { href: "/library", label: "Library", icon: "library" },
  { href: "/grades", label: "CGPA", icon: "chart" },
  { href: "/notifications", label: "Alerts", icon: "bell" },
  { href: "/verify", label: "Verify", icon: "verify" },
  { href: "/login", label: "Login", icon: "user" },
];

export const metadata: Metadata = {
  title: "EDUFARM — Student",
  description: "Verified courses, official materials, CGPA, points and AI study help. Installable PWA.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "EDUFARM" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0E5A3C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Shell uses the shared EDU_CSS language (packages/ui/src/styles.ts) —
// the single source of truth with design.html. Student tone = youthful gradient
// header; geometry identical to lecturer/admin. PWA + 44px targets + gold rings.
const CSS = EDU_CSS;

const SW = `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})});}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="EDUFARM" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body className="tone-student">
        <a className="skip" href="#main">Skip to content</a>
        <style>{CSS}</style>
        <header className="top">
          <nav aria-label="Student">
            <span className="brand-chip"><span className="mark"><Icon name="grad" size={17} /></span> EDUFARM · Student</span>
            <NavLinks items={STUDENT_NAV} linkClassName="navlink" />
            <PortalLinks />
          </nav>
        </header>
        <div className="wrap"><main id="main">{children}</main></div>
        <nav className="bottomnav" aria-label="Quick">
          <MobileBar items={STUDENT_NAV.slice(0, 5)} />
        </nav>
        <script dangerouslySetInnerHTML={{ __html: SW }} />
      </body>
    </html>
  );
}
