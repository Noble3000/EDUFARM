import type { Metadata, Viewport } from "next";
import { Icon } from "@edufarm/ui";
export const metadata: Metadata = {
  title: "EDUFARM — Admin",
  description: "Platform admin: verification, reviews, settlement, disputes, onboarding.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "EDUFARM Admin" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#101828", width: "device-width", initialScale: 1, viewportFit: "cover" };
const CSS = `*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;font-family:Inter,system-ui,sans-serif;font-size:16px;line-height:1.6;color:#101828;background:#F9FAFB}
h1,h2,h3{font-family:Sora,Inter,system-ui,sans-serif;line-height:1.25;margin:0 0 8px;text-align:left}p{margin:0 0 10px;text-align:left}
a{color:#0E5A3C;text-underline-offset:2px}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #C9A227;outline-offset:2px}
header.top{background:#101828;color:#fff;padding:10px 16px;position:sticky;top:0;z-index:30}
header.top nav{display:flex;gap:6px;align-items:center;max-width:1080px;margin:0 auto;flex-wrap:wrap}
.brand-chip{display:inline-flex;align-items:center;gap:9px;font-weight:800;font-family:Sora;font-size:16px;margin-right:8px;white-space:nowrap}
header.top a{color:#E6F4EC;text-decoration:none;font-size:13.5px;font-weight:600;display:inline-flex;align-items:center;gap:7px;padding:9px 11px;border-radius:11px;min-height:44px}
header.top a:hover{background:rgba(255,255,255,.12);color:#fff}.wrap{max-width:1080px;margin:0 auto;padding:20px 16px 60px}
.card{background:#fff;border:1px solid #D0D5DD;border-radius:16px;padding:20px;margin:0 0 14px;text-align:left}
button{background:#0E5A3C;color:#fff;border:0;border-radius:12px;padding:12px 20px;font-weight:700;cursor:pointer;font-size:15px;min-height:44px;display:inline-flex;align-items:center;gap:8px}
button.sec{background:#fff;color:#0E5A3C;border:1.5px solid #0E5A3C}label.flabel{display:block;font-weight:600;font-size:14px;margin:12px 0 5px;text-align:left}input{width:100%;padding:11px 12px;border:1px solid #D0D5DD;border-radius:11px;font-size:16px;margin:0 0 10px;min-height:44px;font-family:inherit}
.muted{color:#344054;font-size:14px}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}`;
const SW = `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})});}`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><head><meta name="mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-capable" content="yes" /><link rel="apple-touch-icon" href="/icons/icon.svg" /></head><body><style>{CSS}</style>
      <header className="top"><nav aria-label="Admin"><span className="brand-chip"><Icon name="shield" size={17} /> EDUFARM · Admin</span><a href="/"><Icon name="home" size={14} /> Home</a><a href="/verifications"><Icon name="verify" size={14} /> Verifications</a><a href="/reviews"><Icon name="file" size={14} /> Reviews</a><a href="/settlements"><Icon name="wallet" size={14} /> Settlement</a><a href="/disputes"><Icon name="dispute" size={14} /> Disputes</a><a href="/email"><Icon name="mail" size={14} /> Email</a><a href="/onboarding"><Icon name="school" size={14} /> Onboarding</a><a href="/login"><Icon name="user" size={14} /> Login</a><a href="/signup"><Icon name="plus" size={14} /> Signup</a></nav></header>
      <div className="wrap"><main>{children}</main></div>
      <script dangerouslySetInnerHTML={{ __html: SW }} />
    </body></html>
  );
}
