// @edufarm/ui — EDU_CSS: the single visual language for student + lecturer + admin.
// Source of truth: design.html v2 + packages/tokens/tokens.json.
// One geometry for every app; youthful-vs-pro is tone (color/gradient), never shape.
// Covers: typography, spacing, radius, borders, shadows, buttons, inputs, labels,
// tabs, badges, alerts, modals/drawers, tables, pagination, empty, skeleton,
// error, focus, disabled, success. All interactive targets >= 44px.
export const EDU_CSS = `:root{--brand:#0E5A3C;--brand-dark:#0A4230;--accent:#C9A227;--ink:#101828;--muted:#344054;--line:#E5E7EB;--line-strong:#D0D5DD;--bg:#F4F6FA;--card:#FFFFFF;--pink:#EC4899;--blue:#175CD3;--bluebg:#EFF8FF;--green:#027A48;--greenbg:#E6F4EC;--amber:#DC6803;--amberbg:#FEF6E7;--red:#D92D20;--redbg:#FEF3F2;--radius:16px;--radius-lg:18px;--radius-hero:20px}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.6;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
h1,h2,h3,h4{font-family:Sora,Inter,system-ui,sans-serif;line-height:1.25;letter-spacing:-.01em;margin:0 0 8px;text-align:left;font-weight:700}
h1{font-size:26px}h2{font-size:22px}h3{font-size:17px}h4{font-size:15px}
p{margin:0 0 10px;text-align:left}
a{color:var(--brand);text-underline-offset:2px}
.skip{position:absolute;left:-9999px;top:0;background:var(--ink);color:#fff;padding:12px 18px;border-radius:0 0 12px 0;z-index:100;min-height:44px}
.skip:focus{left:0}
/* Focus — one gold ring everywhere, keyboard visible */
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,[tabindex]:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:8px}
/* Shell */
header.top{padding:10px 16px;position:sticky;top:0;z-index:30;box-shadow:0 1px 0 rgba(0,0,0,.08)}
header.top nav{display:flex;gap:6px;align-items:center;max-width:1080px;margin:0 auto;flex-wrap:wrap}
.brand-chip{display:inline-flex;align-items:center;gap:9px;color:#fff;font-weight:800;font-family:Sora,Inter,sans-serif;font-size:16px;margin-right:8px;white-space:nowrap}
.brand-chip .mark{width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.14);display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.25)}
header.top a.navlink,header.top nav>a{text-decoration:none;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:7px;padding:9px 12px;border-radius:11px;min-height:44px;line-height:1}
header.top nav .portals{margin-left:auto;display:inline-flex;gap:2px;align-items:center;flex-wrap:wrap}
header.top nav .portals a{font-size:12.5px;font-weight:700;display:inline-flex;align-items:center;gap:5px;padding:9px 10px;border-radius:11px;min-height:44px;text-decoration:none}
.wrap{max-width:1080px;margin:0 auto;padding:20px 16px 60px}
main{display:block}
/* Cards */
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius-lg);padding:20px;margin:0 0 14px;box-shadow:0 1px 2px rgba(16,24,40,.05);text-align:left}
.card.tight{padding:16px}
/* Badges — icon + text share one baseline, never emoji */
.badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:4px 11px;border-radius:999px;margin:0 6px 6px 0;border:1px solid;line-height:1.4;vertical-align:middle;white-space:nowrap}
.b-off{background:var(--greenbg);color:var(--brand);border-color:#A6D6B8}
.b-ver{background:var(--bluebg);color:var(--blue);border-color:#B2DDFF}
.b-urg{background:var(--redbg);color:var(--red);border-color:#FECDCA}
.b-ed{background:#F2F4F7;color:var(--muted);border-color:var(--line-strong)}
.b-pts{background:#FEFBE8;color:#93370D;border-color:#FEDF89}
.b-pink{background:#FDF2F8;color:#BE185D;border-color:#F9A8D4}
.b-ok{background:var(--greenbg);color:var(--green);border-color:#A6D6B8}
.b-info{background:var(--bluebg);color:var(--blue);border-color:#B2DDFF}
.b-warn{background:var(--amberbg);color:var(--amber);border-color:#FEDF89}
.b-bad{background:var(--redbg);color:var(--red);border-color:#FECDCA}
/* Buttons — 44px minimum, no exceptions */
button,.btn{background:var(--brand);color:#fff;border:0;border-radius:12px;padding:12px 20px;font-weight:700;cursor:pointer;font-size:15px;min-height:44px;min-width:44px;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;line-height:1.2;font-family:inherit}
button:hover,.btn:hover{background:var(--brand-dark)}
button.sec,.btn.sec{background:#fff;color:var(--brand);border:1.5px solid var(--brand)}
button.accent,.btn.accent{background:var(--accent);color:#101828}
button.danger,.btn.danger{background:var(--red);color:#fff}
button.ghost,.btn.ghost{background:transparent;color:var(--brand);border:1.5px solid transparent}
button:disabled,.btn:disabled,.btn[aria-disabled="true"]{opacity:.55;cursor:not-allowed}
button.iconbtn,.btn.iconbtn{padding:10px;min-width:44px}
/* Forms — real labels always */
label.flabel{display:block;font-weight:600;font-size:14px;color:var(--ink);margin:12px 0 5px;text-align:left}
.hint{font-size:13.5px;color:var(--muted);margin:2px 0 8px}
.field-err{font-size:13.5px;color:var(--red);font-weight:600;margin:2px 0 8px;display:flex;align-items:center;gap:6px}
.field-ok{font-size:13.5px;color:var(--green);font-weight:600;margin:2px 0 8px;display:flex;align-items:center;gap:6px}
input,textarea,select{width:100%;padding:11px 12px;border:1px solid var(--line-strong);border-radius:11px;font-size:16px;margin:0 0 4px;font-family:inherit;color:var(--ink);background:#fff;min-height:44px}
input::placeholder,textarea::placeholder{color:#475467;opacity:1}
input:focus,textarea:focus,select:focus{border:2px solid var(--brand);outline:3px solid var(--accent);outline-offset:1px}
input[aria-invalid="true"],textarea[aria-invalid="true"],select[aria-invalid="true"]{border:2px solid var(--red)}
input:disabled,textarea:disabled,select:disabled{background:#F2F4F7;color:var(--muted);cursor:not-allowed;opacity:.8}
.checkrow{display:flex;align-items:center;gap:10px;min-height:44px;margin:6px 0;font-size:15px;font-weight:500;cursor:pointer}
.checkrow input{width:22px;height:22px;min-height:22px;margin:0;accent-color:var(--brand);flex-shrink:0}
/* Tabs */
.tabs,.pill-tabs{display:flex;gap:8px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:none}
.tab,.pill-tabs a{flex:0 0 auto;text-decoration:none;font-size:14px;font-weight:700;padding:10px 16px;border-radius:999px;background:#fff;border:1px solid var(--line);color:var(--ink);min-height:44px;display:inline-flex;align-items:center;gap:7px;cursor:pointer;font-family:inherit}
.tab[aria-selected="true"],.pill-tabs a.on,.pill-tabs a[aria-current="page"]{background:var(--ink);color:#fff;border-color:var(--ink)}
/* Alerts */
.alert{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:13px 15px;margin:0 0 12px;font-size:14.5px;border:1px solid;text-align:left}
.alert svg{flex-shrink:0;margin-top:2px}
.alert-info{background:var(--bluebg);border-color:#B2DDFF;color:#1849A9}
.alert-success{background:var(--greenbg);border-color:#A6D6B8;color:#05603A}
.alert-warn{background:var(--amberbg);border-color:#FEDF89;color:#93370D}
.alert-error{background:var(--redbg);border-color:#FECDCA;color:#B42318}
/* Modal + drawer */
.overlay{position:fixed;inset:0;background:rgba(16,24,40,.55);z-index:60;display:flex;align-items:center;justify-content:center;padding:16px}
.modal{background:#fff;border-radius:20px;max-width:520px;width:100%;padding:24px;box-shadow:0 8px 28px rgba(0,0,0,.25);max-height:88vh;overflow:auto}
.modal h2{margin-bottom:6px}
.drawer{position:fixed;top:0;right:0;bottom:0;width:min(420px,94vw);background:#fff;z-index:60;padding:22px;box-shadow:-8px 0 28px rgba(0,0,0,.2);overflow:auto}
.modal-close{position:sticky;top:0;margin-left:auto}
/* Tables */
.tbl-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;margin:0 0 12px;background:#fff}
table.tbl{width:100%;border-collapse:collapse;font-size:14px;min-width:480px}
.tbl th{text-align:left;color:var(--muted);font-weight:600;padding:10px 12px;border-bottom:1px solid var(--line);font-size:13px;background:#F9FAFB;white-space:nowrap}
.tbl td{padding:11px 12px;border-bottom:1px solid #F2F4F7;vertical-align:middle;text-align:left}
.tbl tbody tr:hover{background:#F9FAFB}
.tbl tbody tr:last-child td{border-bottom:0}
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;color:var(--muted);font-weight:600;padding:9px 8px;border-bottom:1px solid var(--line);font-size:13px}
td{padding:10px 8px;border-bottom:1px solid #F2F4F7;vertical-align:middle;text-align:left}
/* Pagination */
.pager{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:12px 0}
.pager button,.pager a{min-width:44px;min-height:44px;padding:10px 14px;border-radius:11px;background:#fff;border:1px solid var(--line-strong);color:var(--ink);font-weight:700;font-size:14px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.pager [aria-current="page"]{background:var(--ink);color:#fff;border-color:var(--ink)}
/* Empty / error / success states */
.empty{text-align:center;padding:28px 18px;border:1px dashed var(--line-strong);border-radius:var(--radius-lg);background:#FCFCFD;margin:0 0 12px}
.empty svg{color:var(--muted)}
.empty h3{margin:10px 0 4px}
.empty p{color:var(--muted);font-size:14px;margin:0 0 12px}
.estate{text-align:left}
.snote{display:flex;gap:10px;align-items:flex-start;background:var(--greenbg);border:1px solid #A6D6B8;color:#05603A;border-radius:12px;padding:13px 15px;margin:0 0 12px;font-size:14.5px}
/* Skeleton loaders */
.skel{border-radius:10px;background:linear-gradient(90deg,#EAECF0 25%,#F2F4F7 50%,#EAECF0 75%);background-size:200% 100%;animation:edushimmer 1.4s infinite;color:transparent !important;min-height:20px}
@keyframes edushimmer{to{background-position:-200% 0}}
/* Misc */
.muted{color:var(--muted);font-size:14px;line-height:1.55}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.row.tight{gap:8px}
.grid2{display:grid;grid-template-columns:1.35fr 1fr;gap:14px;align-items:start}
@media(max-width:900px){.grid2{grid-template-columns:1fr}}
.progress{height:9px;background:#EAECF0;border-radius:99px;overflow:hidden;margin-top:8px}
.progress>div{height:100%;background:linear-gradient(90deg,#0E5A3C,#12B76A);border-radius:99px}
/* Tone: student may use youthful gradient + pink; pro surfaces stay solid + restrained */
.tone-student header.top{background:linear-gradient(135deg,#0E5A3C,#0A4230);color:#fff}
.tone-student header.top a.navlink{color:#E6F4EC}
.tone-student header.top a.navlink:hover{background:rgba(255,255,255,.14);color:#fff}
.tone-student header.top a.navlink[aria-current="page"]{background:rgba(255,255,255,.2);color:#fff;font-weight:800}
.tone-lecturer header.top{background:#0A4230;color:#fff}
.tone-lecturer header.top a{color:#E6F4EC}
.tone-lecturer header.top a:hover{background:rgba(255,255,255,.14);color:#fff}
.tone-lecturer header.top a[aria-current="page"]{background:rgba(255,255,255,.2);color:#fff;font-weight:800}
.tone-admin header.top{background:#101828;color:#fff}
.tone-admin header.top a{color:#E6F4EC}
.tone-admin header.top a:hover{background:rgba(255,255,255,.12);color:#fff}
.tone-admin header.top a[aria-current="page"]{background:rgba(255,255,255,.16);color:#fff;font-weight:800}
.hero-youth{background:linear-gradient(135deg,#0E5A3C 0%,#12805A 55%,#0A4230 100%);color:#fff;border-radius:var(--radius-hero);padding:22px 20px;position:relative;overflow:hidden}
.hero-youth::after{content:"";position:absolute;right:-60px;top:-60px;width:200px;height:200px;border-radius:50%;background:rgba(201,162,39,.28)}
.hero-youth::before{content:"";position:absolute;right:40px;bottom:-80px;width:150px;height:150px;border-radius:50%;background:rgba(236,72,153,.22)}
.hero-youth h2{color:#fff;font-size:24px}
.hero-youth p{color:#E6F4EC}
.hero-pro{background:#0A4230;color:#fff;border-radius:var(--radius-hero);padding:22px 20px}
.hero-pro h2{color:#fff}
.hero-pro p{color:#E6F4EC}
.bottomnav{display:none}
@media(max-width:860px){
.wrap{padding:14px 12px 110px}
.bottomnav{display:flex;position:fixed;left:10px;right:10px;bottom:10px;z-index:40;background:#101828;color:#D0D5DD;border-radius:18px;padding:6px;gap:2px;box-shadow:0 8px 28px rgba(0,0,0,.3);border:1px solid #1D2939}
.bottomnav a{flex:1;text-decoration:none;color:#D0D5DD;font-size:11px;font-weight:700;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 4px;border-radius:13px;min-height:56px;justify-content:center}
.bottomnav a[aria-current="page"]{background:#0E5A3C;color:#fff}
}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto !important;transition:none !important;animation:none !important}}`;
