import type { Metadata } from "next";
import { Icon } from "@edufarm/ui";

export const metadata: Metadata = { title: "EDUFARM — Student" };

const CSS = `:root{--brand:#0E5A3C;--accent:#C9A227;--ink:#101828;--muted:#667085;--line:#D0D5DD;--bg:#F9FAFB}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;color:var(--ink);background:var(--bg)}
a{color:var(--brand)}header.top{background:#0E5A3C;color:#fff;padding:12px 16px;position:sticky;top:0}
header.top nav{display:flex;gap:14px;align-items:center;max-width:960px;margin:0 auto;flex-wrap:wrap}
header.top a{color:#fff;text-decoration:none;font-size:14px}header.top a:hover{text-decoration:underline}
main{max-width:960px;margin:0 auto;padding:20px 16px 60px}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;margin:12px 0}
.badge{display:inline-block;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;margin:2px 6px 2px 0;border:1px solid}
.b-off{background:#E6F4EC;color:#0E5A3C;border-color:#A6D6B8}.b-ver{background:#EFF8FF;color:#175CD3;border-color:#B2DDFF}
.b-urg{background:#FEF3F2;color:#D92D20;border-color:#FECDCA}.b-ed{background:#F2F4F7;color:#344054;border-color:var(--line)}
button,.btn{background:#0E5A3C;color:#fff;border:0;border-radius:10px;padding:9px 16px;font-weight:600;cursor:pointer;font-size:14px}
button.sec{background:#fff;color:#0E5A3C;border:1px solid #0E5A3C}button:disabled{opacity:.5}
input,textarea,select{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:10px;font-size:14px;margin:4px 0 10px}
.muted{color:var(--muted);font-size:13px}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.progress{height:8px;background:#F2F4F7;border-radius:99px;overflow:hidden}.progress>div{height:100%;background:#0E5A3C}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <style>{CSS}</style>
        <header className="top">
          <nav>
            <strong><Icon name="grad" size={16} /> EDUFARM · Student</strong>
            <a href="/"><Icon name="home" size={14} /> Home</a>
            <a href="/courses"><Icon name="book" size={14} /> Courses</a>
            <a href="/library"><Icon name="library" size={14} /> Library</a><a href="/grades"><Icon name="chart" size={14} /> CGPA</a>
            <a href="/verify"><Icon name="verify" size={14} /> Verify</a><a href="/signup"><Icon name="plus" size={14} /> Signup</a>
            <a href="/login"><Icon name="user" size={14} /> Login</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
