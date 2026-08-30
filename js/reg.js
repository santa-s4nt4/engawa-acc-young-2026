/* ============================================================
   登録画面 (reg.html) ロジック — 隠しツール
   ナビゲーションからはリンクされず、URLを直接開いたときだけ使う。
   ?id=<帳面ID> を付けると、その帳面を編集する。
   ============================================================ */
let BOOKS = [];
let draft = null;
const ACCENTS = [['金茶','#C9A227'],['朱','#C7382E'],['若竹','#6FA98A'],['藤','#9B8ACB'],['白練','#D9D2C4']];

function newDraft(){
  return {
    id: uid(), name:'', subtitle:'', accent:'#C9A227', intro:'',
    sections:[{title:'拝受済み',dim:false,lines:''},{title:'これから',dim:true,lines:''}],
    samples:[]
  };
}

function registerHTML(){
  const stale = draft.samples.some(s=>s.engine!==engine);
  return `
  <div class="lede"><h1>登録</h1><p>表紙の写真と、その帳面を開いたときに出すページの中身を一緒に作ります。保存すると写真は特徴ベクトルに変換され、JSONとして持ち出せる形になります。</p></div>
  <div class="note info">保存した内容はこのブラウザだけに残ります。公開サイトに反映するには、帳面一覧の「書き出す」でJSONをダウンロードし、<code>data/books.json</code> を上書きしてコミット・pushしてください。</div>
  ${persistent?'':'<div class="note warn">この環境では自動保存が効きません。登録した内容は画面を閉じると消えるので、帳面一覧からJSONを書き出して保管してください。</div>'}
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
      <div class="field"><label class="f" for="nm">帳面の名前</label>
        <input type="text" id="nm" value="${esc(draft.name)}" placeholder="鎌倉 巡礼帖"></div>
      <div class="two">
        <div class="field"><label class="f" for="sb">見出しの下に出す小文字</label>
          <input type="text" id="sb" value="${esc(draft.subtitle)}" placeholder="令和六年 春"></div>
        <div class="field"><label class="f">ページの色</label>
          <div class="swatches">${ACCENTS.map(([n,c])=>
            `<button class="swatch" title="${n}" data-c="${c}" style="background:${c}" aria-pressed="${draft.accent===c}"></button>`).join('')}</div></div>
      </div>
      <div class="field"><label class="f" for="in">紹介文</label>
        <textarea id="in" rows="3" placeholder="この帳面の由来や、めぐり方の覚え書き">${esc(draft.intro)}</textarea></div>
      <div class="field"><label class="f">節</label><div id="secs"></div>
        <button id="addSec" class="ghost">節を追加</button>
        <p class="hint">1行が1件です。<code>杉本寺 | 5.12 開山堂</code> のように縦棒で区切ると、右側が小さな補足になります。</p></div>
      <div class="btnrow" style="margin-top:6px">
        <button class="primary" id="save">保存する</button>
        <button id="cancel" class="ghost">やめる</button></div>
    </section>
  </div>`;
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
  });
  $('#addSec').onclick=()=>{ pullForm(); draft.sections.push({title:'',dim:false,lines:''}); drawSecs(); };
  $('#save').onclick=saveDraft;
  $('#cancel').onclick=()=>{ location.href='note.html'; };
  drawSecs(); drawShots();
}
function drawSecs(){
  const w=$('#secs'); w.innerHTML='';
  draft.sections.forEach((s,i)=>{
    const d=document.createElement('div'); d.className='sec';
    d.innerHTML=`<div class="top">
        <input type="text" placeholder="節の名前(拝受済み など)" value="${esc(s.title)}" data-t="${i}">
        <label class="toggle"><input type="checkbox" data-d="${i}" ${s.dim?'checked':''}>これから</label>
        <button class="ghost danger" data-x="${i}" title="この節を削除">×</button></div>
      <textarea rows="3" placeholder="杉本寺 | 5.12 開山堂" data-l="${i}">${esc(s.lines)}</textarea>`;
    w.appendChild(d);
  });
  w.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>{pullForm();draft.sections.splice(+b.dataset.x,1);drawSecs()});
  w.querySelectorAll('[data-d]').forEach(b=>b.onchange=()=>draft.sections[+b.dataset.d].dim=b.checked);
}
function pullForm(){
  draft.name=$('#nm').value.trim(); draft.subtitle=$('#sb').value.trim(); draft.intro=$('#in').value;
  document.querySelectorAll('[data-t]').forEach(i=>draft.sections[+i.dataset.t].title=i.value);
  document.querySelectorAll('[data-l]').forEach(i=>draft.sections[+i.dataset.l].lines=i.value);
  document.querySelectorAll('[data-d]').forEach(i=>draft.sections[+i.dataset.d].dim=i.checked);
}
async function addShots(files){
  for(const f of files){ if(!f.type.startsWith('image/'))continue; await addDataURL(await readFile(f),f.name); }
}
async function addDataURL(url,name){
  $('#st').textContent='ベクトル化中…';
  const img=await loadImg(url), cv=toCanvas(img);
  draft.samples.push({thumb:cv.toDataURL('image/jpeg',.82),embedding:await embed(cv),engine,name:name||''});
  $('#st').textContent=''; drawShots();
}
function drawShots(){
  const w=$('#shots'); w.innerHTML='';
  draft.samples.forEach((s,i)=>{
    const d=document.createElement('div'); d.className='shot';
    d.innerHTML=`<img src="${s.thumb}" alt=""><button data-i="${i}" title="外す">×</button><div class="n">${i+1}</div>`;
    w.appendChild(d);
  });
  w.querySelectorAll('button').forEach(b=>b.onclick=()=>{draft.samples.splice(+b.dataset.i,1);drawShots()});
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
  location.href = 'note.html?id=' + encodeURIComponent(draft.id);
}

(async function(){
  BOOKS = await store.load();
  const editId = new URLSearchParams(location.search).get('id');
  const found = editId ? BOOKS.find(b=>b.id===editId) : null;
  draft = found ? JSON.parse(JSON.stringify(found)) : newDraft();
  $('#view').innerHTML = registerHTML();
  bindRegister();

  initEngine(); // MobileNetは裏側で読み込み、フォーム操作は待たせない
})();
