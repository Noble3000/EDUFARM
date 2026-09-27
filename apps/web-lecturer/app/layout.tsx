import type { Metadata } from "next";
export const metadata: Metadata = { title: "EDUFARM — Lecturer" };
const CSS = `:root{--brand:#0E5A3C;--muted:#667085;--line:#D0D5DD;--bg:#F9FAFB}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;color:#101828;background:var(--bg)}
a{color:var(--brand)}header.top{background:#0A4230;color:#fff;padding:12px 16px;position:sticky;top:0}
header.top nav{display:flex;gap:14px;align-items:center;max-width:960px;margin:0 auto;flex-wrap:wrap}
header.top a{color:#fff;text-decoration:none;font-size:14px}main{max-width:960px;margin:0 auto;padding:20px 16px 60px}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;margin:12px 0}
.badge{display:inline-block;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;margin:2px 6px 2px 0;border:1px solid}
.b-off{background:#E6F4EC;color:#0E5A3C;border-color:#A6D6B8}.b-ed{background:#F2F4F7;color:#344054;border-color:var(--line)}
button{background:#0E5A3C;color:#fff;border:0;border-radius:10px;padding:9px 16px;font-weight:600;cursor:pointer;font-size:14px}
button.sec{background:#fff;color:#0E5A3C;border:1px solid #0E5A3C}input,textarea,select{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:10px;font-size:14px;margin:4px 0 10px}
.muted{color:var(--muted);font-size:13px}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body><style>{CSS}</style>
      <header className="top"><nav><strong>EDUFARM · Lecturer</strong><a href="/">Dashboard</a><a href="/login">Login</a></nav></header>
      <main>{children}</main>
    </body></html>
  );
}
