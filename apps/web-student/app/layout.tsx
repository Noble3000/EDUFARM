import type { Metadata, Viewport } from "next";
import { Icon } from "@edufarm/ui";

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

// PWA-first + youthful + strictly aligned shell (v3):
// - tokens match design.html v2 (muted #344054 for 7:1, base 16px/1.6)
// - every block centers on one 1080px rail; text left-aligned; icons+text share one baseline
// - 44px targets, gold focus rings, sticky top nav + mobile bottom nav (PWA thumb zone)
const CSS = `:root{--brand:#0E5A3C;--brand-dark:#0A4230;--accent:#C9A227;--ink:#101828;--muted:#344054;--line:#E5E7EB;--bg:#F4F6FA;--card:#FFFFFF;--pink:#EC4899;--blue:#175CD3;--radius:18px}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:Sora,Inter,system-ui,sans-serif;line-height:1.25;letter-spacing:-.01em;margin:0 0 8px;text-align:left}
p{margin:0 0 10px;text-align:left}
a{color:var(--brand);text-underline-offset:2px}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:8px}
header.top{background:linear-gradient(135deg,#0E5A3C,#0A4230);color:#fff;padding:10px 16px;position:sticky;top:0;z-index:30;box-shadow:0 1px 0 rgba(0,0,0,.08)}
header.top nav{display:flex;gap:6px;align-items:center;max-width:1080px;margin:0 auto;flex-wrap:wrap}
.brand-chip{display:inline-flex;align-items:center;gap:9px;color:#fff;font-weight:800;font-family:Sora;font-size:16px;margin-right:8px;white-space:nowrap}
.brand-chip .mark{width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.14);display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.25)}
header.top a.navlink{color:#E6F4EC;text-decoration:none;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:7px;padding:9px 12px;border-radius:11px;min-height:44px;line-height:1}
header.top a.navlink:hover{background:rgba(255,255,255,.14);color:#fff}
.wrap{max-width:1080px;margin:0 auto;padding:20px 16px 104px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:20px;margin:0 0 14px;box-shadow:0 1px 2px rgba(16,24,40,.05);text-align:left}
.card.tight{padding:16px}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:4px 11px;border-radius:999px;margin:0 6px 6px 0;border:1px solid;line-height:1.4;vertical-align:middle;white-space:nowrap}
.b-off{background:#E6F4EC;color:#0E5A3C;border-color:#A6D6B8}.b-ver{background:#EFF8FF;color:#175CD3;border-color:#B2DDFF}
.b-urg{background:#FEF3F2;color:#D92D20;border-color:#FECDCA}.b-ed{background:#F2F4F7;color:#344054;border-color:#D0D5DD}
.b-pts{background:#FEFBE8;color:#93370D;border-color:#FEDF89}.b-pink{background:#FDF2F8;color:#BE185D;border-color:#F9A8D4}
button,.btn{background:var(--brand);color:#fff;border:0;border-radius:12px;padding:12px 20px;font-weight:700;cursor:pointer;font-size:15px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;line-height:1.2}
button:hover,.btn:hover{background:var(--brand-dark)}
button.sec,.btn.sec{background:#fff;color:var(--brand);border:1.5px solid var(--brand)}
label.flabel{display:block;font-weight:600;font-size:14px;color:var(--ink);margin:12px 0 5px;text-align:left}
input,textarea,select{width:100%;padding:11px 12px;border:1px solid #D0D5DD;border-radius:11px;font-size:16px;margin:0 0 10px;font-family:inherit;color:var(--ink);background:#fff;min-height:44px}
input:focus,textarea:focus,select:focus{border:2px solid var(--brand);outline:3px solid var(--accent);outline-offset:1px}
.muted{color:var(--muted);font-size:14px;line-height:1.55}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.row.tight{gap:8px}
.grid2{display:grid;grid-template-columns:1.35fr 1fr;gap:14px;align-items:start}
@media(max-width:900px){.grid2{grid-template-columns:1fr}}
.progress{height:9px;background:#EAECF0;border-radius:99px;overflow:hidden;margin-top:8px}
.progress>div{height:100%;background:linear-gradient(90deg,#0E5A3C,#12B76A);border-radius:99px}
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;color:var(--muted);font-weight:600;padding:9px 8px;border-bottom:1px solid var(--line);font-size:13px}
td{padding:10px 8px;border-bottom:1px solid #F2F4F7;vertical-align:middle;text-align:left}
.hero-youth{background:linear-gradient(135deg,#0E5A3C 0%,#12805A 55%,#0A4230 100%);color:#fff;border-radius:20px;padding:22px 20px;position:relative;overflow:hidden}
.hero-youth::after{content:"";position:absolute;right:-60px;top:-60px;width:200px;height:200px;border-radius:50%;background:rgba(201,162,39,.28)}
.hero-youth::before{content:"";position:absolute;right:40px;bottom:-80px;width:150px;height:150px;border-radius:50%;background:rgba(236,72,153,.22)}
.hero-youth h2{color:#fff;font-size:24px}
.hero-youth p{color:#E6F4EC}
.pill-tabs{display:flex;gap:8px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:none}
.pill-tabs a{flex:0 0 auto;text-decoration:none;font-size:13.5px;font-weight:700;padding:10px 14px;border-radius:999px;background:#fff;border:1px solid var(--line);color:var(--ink);min-height:44px;display:inline-flex;align-items:center;gap:7px}
.pill-tabs a.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.bottomnav{display:none}
@media(max-width:860px){
  .wrap{padding:14px 12px 110px}
  header.top nav{gap:2px}
  header.top a.navlink{padding:9px 9px;font-size:13px}
  .bottomnav{display:flex;position:fixed;left:10px;right:10px;bottom:10px;z-index:40;background:#101828;color:#D0D5DD;border-radius:18px;padding:6px;gap:2px;box-shadow:0 8px 28px rgba(0,0,0,.3);border:1px solid #1D2939}
  .bottomnav a{flex:1;text-decoration:none;color:#D0D5DD;font-size:11px;font-weight:700;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 4px;border-radius:13px;min-height:56px;justify-content:center}
  .bottomnav a.on{background:#0E5A3C;color:#fff}
}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto !important;transition:none !important}}`;

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
      <body>
        <style>{CSS}</style>
        <header className="top">
          <nav aria-label="Student">
            <span className="brand-chip"><span className="mark"><Icon name="grad" size={17} /></span> EDUFARM · Student</span>
            <a className="navlink" href="/"><Icon name="home" size={14} /> Home</a>
            <a className="navlink" href="/courses"><Icon name="book" size={14} /> Courses</a>
            <a className="navlink" href="/library"><Icon name="library" size={14} /> Library</a>
            <a className="navlink" href="/grades"><Icon name="chart" size={14} /> CGPA</a>
            <a className="navlink" href="/verify"><Icon name="verify" size={14} /> Verify</a>
            <a className="navlink" href="/login"><Icon name="user" size={14} /> Login</a>
          </nav>
        </header>
        <div className="wrap"><main>{children}</main></div>
        <nav className="bottomnav" aria-label="Quick">
          <a href="/"><Icon name="home" size={18} />Home</a>
          <a href="/courses"><Icon name="book" size={18} />Courses</a>
          <a href="/library"><Icon name="library" size={18} />Library</a>
          <a href="/grades"><Icon name="chart" size={18} />CGPA</a>
          <a href="/verify"><Icon name="verify" size={18} />Verify</a>
        </nav>
        <script dangerouslySetInnerHTML={{ __html: SW }} />
      </body>
    </html>
  );
}
