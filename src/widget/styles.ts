/** Styles live inside the Shadow DOM, so host-page CSS can't leak in and ours can't leak out. */
export const STYLES = `
:host{all:initial}
*{box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.root{--accent:#0f766e;--accent-ink:#fff;--bg:#fff;--surface:#f1f5f9;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;
position:fixed;bottom:20px;z-index:2147483000;color:var(--text);font-size:14px;line-height:1.45}
.root.right{right:20px}.root.left{left:20px}
@media (prefers-color-scheme:dark){.root{--bg:#0f172a;--surface:#1e293b;--text:#f1f5f9;--muted:#94a3b8;--border:#334155}}
button,input,textarea{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.launcher{position:relative;width:58px;height:58px;border-radius:50%;border:0;cursor:pointer;background:var(--accent);
color:var(--accent-ink);box-shadow:0 8px 24px rgba(15,23,42,.25);display:grid;place-items:center;transition:transform .15s}
.launcher:hover{transform:scale(1.05)}.launcher svg{width:26px;height:26px}
.badge{position:absolute;top:-4px;right:-4px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#e11d48;
color:#fff;font-size:12px;font-weight:700;display:grid;place-items:center;border:2px solid var(--bg)}
.panel{position:absolute;bottom:74px;width:370px;height:min(600px,calc(100vh - 120px));background:var(--bg);
border:1px solid var(--border);border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,.3);display:flex;flex-direction:column;
overflow:hidden;animation:pop .16s ease-out}
.right .panel{right:0}.left .panel{left:0}
@keyframes pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
[hidden]{display:none!important}
header{display:flex;align-items:center;gap:10px;padding:14px 14px;background:var(--accent);color:var(--accent-ink)}
.avatar{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;font-weight:700}
.titles{flex:1;min-width:0}.title{font-weight:650;font-size:15px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.subtitle{font-size:12px;opacity:.85;margin:0}
.icon-btn{border:0;background:transparent;color:inherit;width:34px;height:34px;border-radius:8px;cursor:pointer;display:grid;place-items:center}
.icon-btn:hover{background:rgba(255,255,255,.15)}.icon-btn svg{width:18px;height:18px}
.log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--bg)}
.msg{max-width:85%;padding:9px 12px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}
.msg.bot{background:var(--surface);border-bottom-left-radius:4px;align-self:flex-start}
.msg.user{background:var(--accent);color:var(--accent-ink);border-bottom-right-radius:4px;align-self:flex-end}
.msg.system{align-self:center;background:transparent;color:var(--muted);font-size:12px;text-align:center}
.sources{margin:6px 0 0;padding:6px 0 0;border-top:1px solid var(--border);font-size:12px;color:var(--muted);list-style:none}
.sources a{color:inherit}
.inline-handoff{margin-top:8px;border:1px solid var(--accent);color:var(--accent);background:transparent;border-radius:999px;
padding:5px 12px;cursor:pointer;font-size:13px;font-weight:600}
.typing{align-self:flex-start;background:var(--surface);border-radius:14px;padding:10px 14px;display:flex;gap:4px}
.typing span{width:6px;height:6px;border-radius:50%;background:var(--muted);animation:blink 1.2s infinite}
.typing span:nth-child(2){animation-delay:.2s}.typing span:nth-child(3){animation-delay:.4s}
@keyframes blink{0%,80%,100%{opacity:.25}40%{opacity:1}}
.chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px}
.chip{border:1px solid var(--border);background:var(--bg);border-radius:999px;padding:5px 11px;cursor:pointer;font-size:13px}
.chip:hover{border-color:var(--accent);color:var(--accent)}
.composer{display:flex;gap:8px;padding:10px;border-top:1px solid var(--border)}
.composer textarea{flex:1;resize:none;border:1px solid var(--border);background:var(--bg);border-radius:10px;padding:9px 11px;
height:42px;max-height:110px}
.send{border:0;background:var(--accent);color:var(--accent-ink);border-radius:10px;width:42px;cursor:pointer;display:grid;place-items:center}
.send:disabled{opacity:.5;cursor:not-allowed}.send svg{width:18px;height:18px}
.handoff{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.handoff h3{margin:0;font-size:16px}.handoff p{margin:0;color:var(--muted)}
.field{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600}
.field input,.field textarea{border:1px solid var(--border);background:var(--bg);border-radius:8px;padding:8px 10px;font-weight:400}
.error{color:#e11d48;font-size:13px;margin:0}
.primary{border:0;background:var(--accent);color:var(--accent-ink);border-radius:10px;padding:10px;font-weight:650;cursor:pointer}
.links{display:flex;gap:8px}.links a{flex:1;text-align:center;border:1px solid var(--border);border-radius:10px;padding:8px;
color:var(--text);text-decoration:none;font-weight:600}
.link-btn{border:0;background:none;color:var(--accent);cursor:pointer;padding:4px 0;text-align:left;font-weight:600}
footer{font-size:11px;text-align:center;color:var(--muted);padding:6px;border-top:1px solid var(--border)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:480px){.root.open{inset:0}.root.open .panel{position:fixed;inset:0;width:100%;height:100%;border-radius:0;border:0}
.root.open .launcher{display:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;
