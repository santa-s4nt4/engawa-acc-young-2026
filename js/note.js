/* ============================================================
   帳面画面 (note.html) ロジック — 一覧 + 帳面ページ
   ?id=<帳面ID> があれば帳面ページ、なければ一覧を表示する。
   登録(reg.html)へのボタン遷移はここには置かない。
   編集したい場合は帳面ページに表示されるIDを使って
   reg.html?id=<ID> を直接開く(隠しツール)。
   ============================================================ */
let BOOKS = [];

function parseLines(t){
  return String(t||'').split('\n').map(l=>l.trim()).filter(Boolean)
    .map(l=>{const i=l.indexOf('|');return i<0?[l,'']:[l.slice(0,i).trim(),l.slice(i+1).trim()]});
}

/* ---- 一覧 ---- */
function libraryHTML(){
  return `
  <div class="crumb"><a href="index.html" style="color:inherit">← 読み取りへ</a></div>
  <div class="lede"><h1>帳面</h1><p>登録済みの帳面と、その元になっているJSONの出し入れ。</p></div>
  ${persistent?'':'<div class="note warn">この環境では自動保存が効きません。JSONを書き出して保管してください。</div>'}
  <section class="panel" style="margin-bottom:18px"><h2>登録済み ${BOOKS.length} 冊</h2>
    ${BOOKS.length?`<div class="lib">${BOOKS.map(b=>`
      <article class="card"><img src="${b.samples[0].thumb}" alt="">
        <div class="body"><div class="nm">${esc(b.name)}</div>
          <div class="mt">${b.samples.length}枚 · ${b.samples[0].embedding.length}次元 · ${esc(b.samples[0].engine)}</div>
          <div class="acts"><button data-open="${b.id}">開く</button>
            <button class="danger" data-del="${b.id}">削除</button></div></div></article>`).join('')}</div>`
      : '<div class="empty">まだ1冊もありません。</div>'}
  </section>
  <section class="panel"><h2>JSON</h2>
    <div class="btnrow">
      <button id="dl">書き出す(ダウンロード)</button>
      <button id="show">画面に出す</button>
      <button id="up">読み込む</button>
      <button class="danger" id="wipe">全部消す</button></div>
    <input type="file" id="jf" accept="application/json,.json" hidden>
    <p class="hint" style="margin-top:12px">書き出したJSONには帳面ごとに <code>id / name / subtitle / accent / intro / sections</code> とベクトル <code>samples[].embedding</code> が入ります。写真は224px正方のJPEGとして <code>thumb</code> に埋め込まれるので、別の端末で読み込んでもそのまま再現できます。本番でベクトルだけを配信したい場合は <code>thumb</code> を落としてください。</p>
    <p class="hint">公開して誰でも読み取り〜帳面を見られるようにするには、書き出したJSONで <code>data/books.json</code> を上書きしてコミット・pushしてください。reg.htmlで登録した内容はこのブラウザだけに保存されており、<code>data/books.json</code> を更新するまでは公開サイトには反映されません。</p>
    <div class="status" id="st"></div>
  </section>`;
}
function bindLibrary(){
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{ location.href='note.html?id='+encodeURIComponent(b.dataset.open); });
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{
    const t=BOOKS.find(x=>x.id===b.dataset.del);
    if(!confirm(`「${t.name}」を消します。よろしいですか。`))return;
    BOOKS=BOOKS.filter(x=>x.id!==b.dataset.del);await store.save(BOOKS);renderView()});
  $('#dl').onclick=()=>{
    const blob=new Blob([JSON.stringify(BOOKS,null,1)],{type:'application/json'});
    try{ const a=document.createElement('a');a.href=URL.createObjectURL(blob);
      a.download='goshuincho.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
      $('#st').textContent='goshuincho.json を書き出しました'; }
    catch(e){ showJSON(); }
  };
  $('#show').onclick=showJSON;
  $('#up').onclick=()=>$('#jf').click();
  $('#jf').onchange=async e=>{
    const f=e.target.files[0]; if(!f)return;
    try{
      const arr=JSON.parse(await f.text());
      if(!Array.isArray(arr))throw 0;
      let n=0;
      for(const b of arr){ if(!b.id||!b.samples?.length)continue;
        while(BOOKS.some(x=>x.id===b.id)) b.id=uid();
        BOOKS.push(b); n++; }
      await store.save(BOOKS); renderView(); $('#st').textContent=`${n}冊を読み込みました`;
    }catch(err){ $('#st').textContent='JSONの形が違うようです'; }
  };
  $('#wipe').onclick=async()=>{ if(!confirm('登録済みの帳面をすべて消します。よろしいですか。'))return;
    BOOKS=[];await store.save(BOOKS);renderView()};
}
function showJSON(){ $('#jsonOut').value=JSON.stringify(BOOKS,null,1); $('#jsonDlg').showModal(); }

/* ---- 帳面ページ ---- */
function bookHTML(id){
  const b=BOOKS.find(x=>x.id===id);
  if(!b) return `
    <div class="crumb"><a href="note.html" style="color:inherit">← 一覧へ</a></div>
    <div class="panel"><div class="empty">この帳面は見つかりません。</div></div>`;
  const secs=b.sections.filter(s=>parseLines(s.lines).length||s.title);
  const done=secs.filter(s=>!s.dim).reduce((n,s)=>n+parseLines(s.lines).length,0);
  const all=secs.reduce((n,s)=>n+parseLines(s.lines).length,0);
  const hasDim=secs.some(s=>s.dim)&&all>0;
  return `
  <div class="crumb"><a href="index.html" style="color:inherit">← 読み取りに戻る</a>
    <span>${esc(b.name)} / ${b.samples.length}枚で登録</span></div>
  <div style="--accent:${esc(b.accent||'#C9A227')}">
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
function bindBook(){}

/* ---- ルーティング(クエリの id で一覧/帳面ページを切り替え) ---- */
function renderView(){
  const id=new URLSearchParams(location.search).get('id');
  const m=$('#view');
  if(id){ m.innerHTML=bookHTML(id); bindBook(); }
  else{ m.innerHTML=libraryHTML(); bindLibrary(); }
}

(async function(){
  BOOKS = await store.load();
  renderView();
})();
