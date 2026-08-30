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
