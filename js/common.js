/* ============================================================
   共通JS — index.html / reg.html / note.html すべてで読み込む
   保存層・基本ユーティリティのみ。ページ固有のロジックは持たない。
   ============================================================ */

/* ---- 保存層 ----
   1. window.storage (あれば)
   2. localStorage — reg.html でこのブラウザ内に登録した下書き
   3. data/books.json — GitHub Pages 等で公開する際にリポジトリへコミットする静的データ
   1・2 に何もなければ 3 にフォールバックするので、reg.html を触ったことのない
   訪問者のブラウザでも公開済みの帳面がそのまま表示される。
   ---------------------------------------------------------------- */
const KEY = 'goshuin:books:v1';
const STATIC_JSON = 'data/books.json';
let persistent = false;
const store = {
  async load(){
    try{
      const r = await window.storage.get(KEY);
      const v = r ? JSON.parse(r.value) : [];
      persistent = true;
      if(v.length) return v;
    }catch(e){}
    try{
      const raw = localStorage.getItem(KEY);
      const v = raw ? JSON.parse(raw) : [];
      persistent = true;
      if(v.length) return v;
    }catch(e){}
    try{
      const res = await fetch(STATIC_JSON, {cache:'no-store'});
      if(res.ok) return await res.json();
    }catch(e){}
    return [];
  },
  async save(v){
    try{
      await window.storage.set(KEY, JSON.stringify(v));
      persistent = true;
      return true;
    }catch(e){
      try{
        localStorage.setItem(KEY, JSON.stringify(v));
        persistent = true;
        return true;
      }catch(_){ persistent = false; return false; }
    }
  }
};

/* ---- 基本ユーティリティ ---- */
const $ = s => document.querySelector(s);
const uid = () => 'bk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---- 帳面ページの描画 — note.html(本物)と reg.html(プレビュー)で共用 ---- */
function parseLines(t){
  return String(t||'').split('\n').map(l=>l.trim()).filter(Boolean)
    .map(l=>{const i=l.indexOf('|');return i<0?[l,'']:[l.slice(0,i).trim(),l.slice(i+1).trim()]});
}
function renderBookPage(b){
  const secs=b.sections.filter(s=>parseLines(s.lines).length||s.title);
  const done=secs.filter(s=>!s.dim).reduce((n,s)=>n+parseLines(s.lines).length,0);
  const all=secs.reduce((n,s)=>n+parseLines(s.lines).length,0);
  const hasDim=secs.some(s=>s.dim)&&all>0;
  return `
  <div style="--accent:${esc(b.accent||'#C08A1E')}">
    <div class="fold"><div class="bookhead"><img src="${b.samples[0].thumb}" alt="">
      <div><h3>${esc(b.name)}</h3>
        ${b.subtitle?`<div class="sub">${esc(b.subtitle)}</div>`:''}
        ${b.intro?`<p class="desc">${esc(b.intro)}</p>`:''}
        ${hasDim?`<div class="prog"><div class="track"><div class="fill" style="width:${Math.round(done/all*100)}%"></div></div>
          <div class="n">${done} / ${all}</div></div>`:''}
      </div></div></div>
    ${secs.map(s=>{const it=parseLines(s.lines);return `
      <div class="fold"><h4>${esc(s.title||'—')}</h4>
        ${it.length?`<ul class="stamps">${it.map(([p,d])=>
          `<li class="${s.dim?'dim':'done'}"><div class="p">${esc(p)}</div><div class="d">${esc(d||'—')}</div></li>`).join('')}</ul>`
          :'<div class="empty">まだ何もありません。</div>'}</div>`}).join('')}
    <div class="fold"><h4>この帳面について</h4>
      <p class="hint">ID <code>${esc(b.id)}</code> · ${b.samples[0].embedding.length}次元 · ${esc(b.samples[0].engine)}</p></div>
  </div>`;
}
