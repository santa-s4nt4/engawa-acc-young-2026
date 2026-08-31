/* ============================================================
   登録画面 (reg.html) ロジック — 隠しツール
   ナビゲーションからはリンクされず、URLを直接開いたときだけ使う。
   ?id=<帳面ID> を付けると、その帳面を編集する。

   編集フォーム・帳面ページのプレビュー・JSONの書き出し/読み込み/削除を
   ページ遷移せず同じ画面で行えるようにしてある。
   ============================================================ */
let BOOKS = [];
let draft = null;
const ACCENTS = [['金茶','#C08A1E'],['朱','#DE3A2A'],['若竹','#2E9A6E'],['藤','#7A5FC4'],['白練','#7A6A52']];

function newDraft(){
  return {
    id: uid(), name:'', accent:'#C08A1E', intro:'',
    sections:[{title:'',lines:''}],
    samples:[]
  };
}

function registerHTML(){
  const stale = draft.samples.some(s=>s.engine!==engine);
  return `
  <div class="lede"><h1>登録</h1><p>表紙の写真と、その帳面を開いたときに出すページの中身を一緒に作ります。右側でその場でプレビューしながら編集できます。</p></div>
  <div class="note info">保存した内容はこのブラウザだけに残ります。公開サイトに反映するには、下の「JSON」欄の「書き出す」でダウンロードし、<code>data/books.json</code> を上書きしてコミット・pushしてください。</div>
  ${persistent?'':'<div class="note warn">この環境では自動保存が効きません。登録した内容は画面を閉じると消えるので、下のJSON欄から書き出して保管してください。</div>'}
  ${stale?'<div class="note warn">この帳面のベクトルは今と違う特徴抽出器で作られています。保存し直すと現在の抽出器で取り直されます。</div>':''}
  <div class="cols">
    <section class="panel">
      <h2>表紙の写真</h2>
      <div class="drop" id="drop" tabindex="0" role="button"><div class="mark">写</div>
        <p>同じ帳面を角度や明るさを変えて数枚入れると、照合がぐっと安定します</p></div>
      <div class="btnrow" style="margin-top:12px">
        <button id="pick">画像を選ぶ</button><button id="cam">カメラで撮る</button></div>
      <input type="file" id="f1" accept="image/*" multiple hidden><input type="file" id="f2" accept="image/*" capture="environment" hidden>
      <div class="shots" id="shots"></div>
      <div class="status" id="st"></div>
    </section>

    <section class="panel">
      <h2>ページの中身</h2>
      <div class="field"><label class="f" for="nm">神社の名前</label>
        <input type="text" id="nm" value="${esc(draft.name)}" placeholder="鶴岡八幡宮"></div>
      <div class="field"><label class="f">ページの色</label>
        <div class="swatches">${ACCENTS.map(([n,c])=>
          `<button class="swatch" title="${n}" data-c="${c}" style="background:${c}" aria-pressed="${draft.accent===c}"></button>`).join('')}</div></div>
      <div class="field"><label class="f" for="in">神社の概要</label>
        <textarea id="in" rows="3" placeholder="神社の由来や見どころ">${esc(draft.intro)}</textarea></div>
      <div class="field"><label class="f">奉納している酒蔵</label><div id="secs"></div>
        <button id="addSec" class="ghost">酒蔵を追加</button>
        <p class="hint">節ごとに酒蔵を1つ登録します。中の1行が飲食店1件です。<code>地酒 えん | 鎌倉市御成町1-2</code> のように縦棒で区切ると、右側が住所などの補足になります。</p></div>
      <div class="btnrow" style="margin-top:6px">
        <button class="primary" id="save">保存する</button>
        <button id="cancel" class="ghost">新しい帳面にする</button></div>
    </section>
  </div>

  <div class="cols" style="margin-top:20px">
    <section class="panel">
      <h2>プレビュー</h2>
      <div id="preview"></div>
    </section>

    <section class="panel">
      <h2>登録済み帳面 / JSON</h2>
      <div class="sec">
        <p class="hint" style="margin:0 0 8px">複数の写真をまとめて選ぶと、1枚ごとに別の帳面として一括で作成します(名前はファイル名から仮でつくので、あとで「編集」から直せます)。</p>
        <div class="btnrow"><button id="bulkPick">複数の写真からまとめて作る</button></div>
        <input type="file" id="bulkFile" accept="image/*" multiple hidden>
        <div class="status" id="bulkSt"></div>
      </div>
      <div class="booklist" id="bookList"></div>
      <div class="btnrow">
        <button id="dl">書き出す(ダウンロード)</button>
        <button id="show">画面に出す</button>
        <button id="up">読み込む</button>
        <button class="danger" id="wipe">全部消す</button></div>
      <input type="file" id="jf" accept="application/json,.json" hidden>
      <p class="hint" style="margin-top:12px">公開サイトに反映するには、書き出したJSONで <code>data/books.json</code> を上書きしてコミット・pushしてください。</p>
      <div class="status" id="jsonSt"></div>
    </section>
  </div>`;
}
function renderAll(){
  $('#view').innerHTML = registerHTML();
  bindRegister();
}
function bindRegister(){
  const drop=$('#drop');
  drop.onclick=()=>$('#f1').click();
  drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#f1').click();}};
  $('#pick').onclick=()=>$('#f1').click(); $('#cam').onclick=()=>$('#f2').click();
  $('#f1').onchange=e=>addShots([...e.target.files]);
  $('#f2').onchange=e=>addShots([...e.target.files]);
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over')});
  drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');addShots([...e.dataTransfer.files])});
  document.querySelectorAll('.swatch').forEach(b=>b.onclick=()=>{
    draft.accent=b.dataset.c;
    document.querySelectorAll('.swatch').forEach(x=>x.setAttribute('aria-pressed',x.dataset.c===draft.accent));
    renderPreview();
  });
  $('#addSec').onclick=()=>{ pullForm(); draft.sections.push({title:'',lines:''}); drawSecs(); renderPreview(); };
  $('#save').onclick=saveDraft;
  $('#cancel').onclick=()=>{ draft=newDraft(); history.replaceState(null,'','reg.html'); renderAll(); };

  /* テキスト入力・チェックボックスはまとめて拾ってプレビューに反映する */
  const view=$('#view');
  view.addEventListener('input', ()=>{ pullForm(); renderPreview(); });
  view.addEventListener('change', ()=>{ pullForm(); renderPreview(); });

  $('#bulkPick').onclick=()=>$('#bulkFile').click();
  $('#bulkFile').onchange=e=>{ bulkAddBooks([...e.target.files]); e.target.value=''; };

  drawSecs(); drawShots(); renderPreview(); renderBookList();
  bindJson();
}
function drawSecs(){
  const w=$('#secs'); w.innerHTML='';
  draft.sections.forEach((s,i)=>{
    const d=document.createElement('div'); d.className='sec';
    d.innerHTML=`<div class="top">
        <input type="text" placeholder="酒蔵の名前(月の井酒造 など)" value="${esc(s.title)}" data-t="${i}">
        <button class="ghost danger" data-x="${i}" title="この酒蔵を削除">×</button></div>
      <textarea rows="3" placeholder="地酒 えん | 鎌倉市御成町1-2" data-l="${i}">${esc(s.lines)}</textarea>`;
    w.appendChild(d);
  });
  w.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>{pullForm();draft.sections.splice(+b.dataset.x,1);drawSecs();renderPreview()});
}
function pullForm(){
  draft.name=$('#nm').value.trim(); draft.intro=$('#in').value;
  document.querySelectorAll('[data-t]').forEach(i=>draft.sections[+i.dataset.t].title=i.value);
  document.querySelectorAll('[data-l]').forEach(i=>draft.sections[+i.dataset.l].lines=i.value);
}
async function addShots(files){
  const imgs=files.filter(f=>f.type.startsWith('image/'));
  for(let i=0;i<imgs.length;i++){
    $('#st').textContent = imgs.length>1 ? `ベクトル化中…(${i+1}/${imgs.length})` : 'ベクトル化中…';
    await addDataURL(await readFile(imgs[i]), imgs[i].name);
  }
  $('#st').textContent='';
}
async function addDataURL(url,name){
  const img=await loadImg(url), cv=toCanvas(img);
  draft.samples.push({thumb:cv.toDataURL('image/jpeg',.82),embedding:await embed(cv),engine,name:name||''});
  drawShots(); renderPreview();
}
function drawShots(){
  const w=$('#shots'); w.innerHTML='';
  draft.samples.forEach((s,i)=>{
    const d=document.createElement('div'); d.className='shot';
    d.innerHTML=`<img src="${s.thumb}" alt=""><button data-i="${i}" title="外す">×</button><div class="n">${i+1}</div>`;
    w.appendChild(d);
  });
  w.querySelectorAll('button').forEach(b=>b.onclick=()=>{draft.samples.splice(+b.dataset.i,1);drawShots();renderPreview()});
}
function renderPreview(){
  const el=$('#preview'); if(!el) return;
  el.innerHTML = draft.samples.length
    ? renderBookPage(draft)
    : '<div class="empty">写真を1枚追加すると、ここに帳面ページのプレビューが表示されます。</div>';
}
async function saveDraft(){
  pullForm();
  if(!draft.name){ $('#nm').focus(); $('#st').textContent='名前を入れてください'; return; }
  if(!draft.samples.length){ $('#st').textContent='表紙の写真を1枚以上入れてください'; return; }
  $('#st').textContent='保存中…';
  await reembedStale(draft.samples);
  const i=BOOKS.findIndex(b=>b.id===draft.id);
  i<0 ? BOOKS.push(draft) : BOOKS[i]=draft;
  await store.save(BOOKS);
  $('#st').textContent='保存しました';
  history.replaceState(null,'','reg.html?id='+encodeURIComponent(draft.id));
  renderPreview(); renderBookList();
}

/* ---- 複数写真からの一括登録(1枚 = 1帳面) ---- */
async function bulkAddBooks(files){
  const imgs=files.filter(f=>f.type.startsWith('image/'));
  if(!imgs.length) return;
  for(let i=0;i<imgs.length;i++){
    $('#bulkSt').textContent = `作成中…(${i+1}/${imgs.length})`;
    const f=imgs[i];
    const img=await loadImg(await readFile(f)), cv=toCanvas(img);
    const b=newDraft();
    b.name = f.name.replace(/\.[^.]+$/,'').trim() || '無題の帳面';
    b.samples.push({thumb:cv.toDataURL('image/jpeg',.82),embedding:await embed(cv),engine,name:f.name});
    BOOKS.push(b);
  }
  await store.save(BOOKS);
  $('#bulkSt').textContent = `${imgs.length}冊を作成しました。名前や中身は各帳面の「編集」から整えてください。`;
  renderBookList();
}

/* ---- 登録済み帳面リスト ---- */
function renderBookList(){
  const w=$('#bookList'); if(!w) return;
  if(!BOOKS.length){ w.innerHTML='<div class="empty">まだ1冊も登録されていません。</div>'; return; }
  w.innerHTML = BOOKS.map(b=>`
    <div class="row ${b.id===draft.id?'active':''}">
      <img src="${b.samples[0].thumb}" alt="">
      <div class="nm">${esc(b.name)}</div>
      <div class="mt">${b.samples.length}枚・${esc(b.samples[0].engine)}</div>
      <div class="acts">
        <button data-edit="${b.id}">編集</button>
        <button class="danger" data-del="${b.id}">削除</button>
      </div>
    </div>`).join('');
  w.querySelectorAll('[data-edit]').forEach(btn=>btn.onclick=()=>{
    draft = JSON.parse(JSON.stringify(BOOKS.find(b=>b.id===btn.dataset.edit)));
    history.replaceState(null,'','reg.html?id='+encodeURIComponent(draft.id));
    renderAll();
  });
  w.querySelectorAll('[data-del]').forEach(btn=>btn.onclick=async()=>{
    const t=BOOKS.find(b=>b.id===btn.dataset.del);
    if(!confirm(`「${t.name}」を消します。よろしいですか。`))return;
    const wasEditing = draft.id===t.id;
    BOOKS=BOOKS.filter(b=>b.id!==t.id);
    await store.save(BOOKS);
    if(wasEditing){ draft=newDraft(); history.replaceState(null,'','reg.html'); }
    renderAll();
  });
}

/* ---- JSON 書き出し/読み込み/削除 ---- */
function bindJson(){
  $('#dl').onclick=()=>{
    const blob=new Blob([JSON.stringify(BOOKS,null,1)],{type:'application/json'});
    try{ const a=document.createElement('a');a.href=URL.createObjectURL(blob);
      a.download='goshuincho.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
      $('#jsonSt').textContent='goshuincho.json を書き出しました'; }
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
      await store.save(BOOKS); renderBookList();
      $('#jsonSt').textContent=`${n}冊を読み込みました`;
    }catch(err){ $('#jsonSt').textContent='JSONの形が違うようです'; }
  };
  $('#wipe').onclick=async()=>{ if(!confirm('登録済みの帳面をすべて消します。よろしいですか。'))return;
    BOOKS=[]; await store.save(BOOKS);
    draft=newDraft(); history.replaceState(null,'','reg.html');
    renderAll();
  };
}
function showJSON(){ $('#jsonOut').value=JSON.stringify(BOOKS,null,1); $('#jsonDlg').showModal(); }

(async function(){
  BOOKS = await store.load();
  const editId = new URLSearchParams(location.search).get('id');
  const found = editId ? BOOKS.find(b=>b.id===editId) : null;
  draft = found ? JSON.parse(JSON.stringify(found)) : newDraft();
  renderAll();

  initEngine(); // MobileNetは裏側で読み込み、フォーム操作は待たせない
})();
