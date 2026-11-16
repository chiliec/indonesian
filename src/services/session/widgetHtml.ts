/** The practice-card widget: fixed code, drawn from TelegramWidget.chatData (see WidgetRenderer). */
export const WIDGET_HTML = `<style>
:root{color-scheme:light dark}
body{margin:0;padding:12px 12px calc(12px + env(safe-area-inset-bottom));font:var(--tg-text-font-size,15px)/1.4 system-ui,sans-serif;color:var(--tg-theme-text-color)}
.h{display:flex;justify-content:space-between;font-size:.85em;color:var(--tg-theme-hint-color);margin-bottom:4px}
.bar{height:6px;border-radius:3px;background:var(--tg-theme-secondary-bg-color);overflow:hidden;margin-bottom:10px}
.bar i{display:block;height:100%;background:var(--tg-theme-button-color);transition:width .3s}
.p{white-space:pre-line;margin:6px 0}
.s{font-size:.9em;color:var(--tg-theme-hint-color);margin-top:4px}
.f{color:#2e9e5b}
.x{color:var(--tg-theme-destructive-text-color)}
.g{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.g3{grid-template-columns:1fr 1fr 1fr}
button{font:inherit;color:var(--tg-theme-text-color);background:var(--tg-theme-secondary-bg-color);border:0;border-radius:10px;padding:10px 6px;width:100%;transition:background .15s}
button:active{opacity:.7}
.w{margin-top:10px;background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color)}
.out{min-height:1.4em;padding:8px;border-radius:10px;border:1px dashed var(--tg-theme-hint-color);font-weight:600}
button.ok,.out.ok{background:#2e9e5b;color:#fff}
button.bad,.out.bad{background:var(--tg-theme-destructive-text-color);color:#fff}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
<div id="app"></div>
<script>
const W=window.TelegramWidget,app=document.getElementById('app');
let st=null,last,done=0,picked=[];
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;app.append(e);return e}
function hap(ok){try{W.HapticFeedback.notificationOccurred(ok?'success':'error')}catch(e){}}
function fail(data){const b=el('button','w','⚠️ Tap to retry');b.onclick=()=>{b.remove();send(data)}}
function send(data){W.request(data).then(a=>{if(a.result==='expired'){app.textContent='';el('div','p','⌛ Session expired — tap ▶️ Practice')}else if(a.result!=='ok')fail(data);else setTimeout(()=>{if(W.chatData===last){last=null;render()}},3000)},()=>fail(data))}
function btn(text,data){const b=el('button','w',text);b.onclick=()=>{if(done)return;done=1;send(data)}}
function fb(){const f=st.fb||{};
if(f.w)el('div','p',f.w+' — '+f.e);
if(f.s)el('div','s','📖 '+f.s+' — '+f.se);
if(f.nt)el('div','s','💡 '+f.nt)}
function wrong(){el('div','p x','❌ Not quite. Correct answer: '+st.a);fb()}
function options(){const g=el('div','g');
st.o.forEach((t,i)=>{const b=document.createElement('button');b.textContent=t;g.append(b);
b.onclick=()=>{if(done)return;done=1;const ok=i===st.c;b.className=ok?'ok':'bad';
if(!ok){g.children[st.c].className='ok';wrong()}
hap(ok);send('a:'+st.q+':'+i)}})}
function builder(){const out=el('div','out'),g=el('div','g g3'),undo=el('button','w','↩️ Undo');
const draw=()=>{out.textContent=picked.map(i=>st.t[i]).join(' ')||'—';
[...g.children].forEach((b,i)=>{b.hidden=picked.includes(i)});
undo.hidden=done||!picked.length};
st.t.forEach((t,i)=>{const b=document.createElement('button');b.textContent=t;g.append(b);
b.onclick=()=>{if(done)return;picked.push(i);
if(picked.length===st.t.length){done=1;const ok=picked.map(j=>st.t[j]).join(' ')===st.a;
out.className='out '+(ok?'ok':'bad');draw();if(!ok)wrong();hap(ok);send('b:'+st.q+':'+picked.join(','));return}
draw()}});
undo.onclick=()=>{picked.pop();draw()};draw()}
function finish(){el('div','p',st.ex?'⌛ Session expired.':'🏁 Session done!');
el('div','','✅ '+st.sc+'/'+st.tot+' · ⭐ +'+st.xe+' XP');
if(st.nw.length)el('div','s','🆕 New: '+st.nw.join(', '));
if(st.mw.length){el('div','s','🔁 To review:');st.mw.forEach(w=>el('div','s','• '+w))}
if(st.more)el('div','s','…and '+st.more+' more');
if(st.due)el('div','s','📅 '+st.due+' word'+(st.due===1?'':'s')+' due tomorrow');
btn('▶️ Practice again','again')}
function render(){const raw=W.chatData;if(raw===last)return;last=raw;
try{st=JSON.parse(raw)}catch(e){st=null}
done=0;picked=[];app.textContent='';
if(!st)return;
if(st.k==='finish')return finish();
const h=el('div','h');h.innerHTML='<span></span><span></span>';
h.children[0].textContent='🎯 Practice · '+(st.i+1)+'/'+st.n;h.children[1].textContent='⭐ '+st.xp+' XP';
el('div','bar').innerHTML='<i style="width:'+Math.round(st.i/st.n*100)+'%"></i>';
if(st.fl)el('div','f','✅ '+st.fl.l+' +'+st.fl.x+' XP');
if(st.k==='feedback'){wrong();btn('▶️ Next','n:'+st.q);return}
el('div','p').innerHTML=st.p;
if(st.o)options();
if(st.t)builder();
if(st.k==='intro')btn('Got it ▶️','n:'+st.q);
if(st.k==='type')el('div','s','⌨️ Type your answer in the chat');
if(st.k==='speak')el('div','s','🎤 Send a voice note')}
if(W){W.onEvent('chatDataChanged',render);render();if(typeof W.ready==='function')W.ready()}
</script>`;
