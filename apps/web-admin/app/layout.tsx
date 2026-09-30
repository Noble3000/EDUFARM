import type { Metadata } from "next";
import { Icon } from "@edufarm/ui";
export const metadata: Metadata = { title: "EDUFARM — Admin" };
const CSS = `*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;color:#101828;background:#F9FAFB}
a{color:#0E5A3C}header.top{background:#101828;color:#fff;padding:12px 16px;position:sticky;top:0}
header.top nav{display:flex;gap:14px;align-items:center;max-width:960px;margin:0 auto;flex-wrap:wrap}
header.top a{color:#fff;text-decoration:none;font-size:14px}main{max-width:960px;margin:0 auto;padding:20px 16px 60px}
.card{background:#fff;border:1px solid #D0D5DD;border-radius:14px;padding:16px;margin:12px 0}
button{background:#0E5A3C;color:#fff;border:0;border-radius:10px;padding:9px 16px;font-weight:600;cursor:pointer;font-size:14px}
button.sec{background:#fff;color:#0E5A3C;border:1px solid #0E5A3C}input{width:100%;padding:9px 10px;border:1px solid #D0D5DD;border-radius:10px;font-size:14px;margin:4px 0 10px}
.muted{color:#667085;font-size:13px}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body><style>{CSS}</style>
      <header className="top"><nav><strong><Icon name="shield" size={16} /> EDUFARM · Admin</strong><a href="/"><Icon name="home" size={14} /> Home</a><a href="/verifications"><Icon name="verify" size={14} /> Verifications</a><a href="/reviews"><Icon name="file" size={14} /> Reviews</a><a href="/settlements"><Icon name="wallet" size={14} /> Settlement</a><a href="/disputes"><Icon name="dispute" size={14} /> Disputes</a><a href="/email"><Icon name="mail" size={14} /> Email</a><a href="/onboarding"><Icon name="school" size={14} /> Onboarding</a><a href="/login"><Icon name="user" size={14} /> Login</a><a href="/signup"><Icon name="plus" size={14} /> Signup</a></nav></header>
      <main>{children}</main>
    </body></html>
  );
}
