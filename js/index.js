/* ============================================================
   読み取り画面 (index.html) ロジック
   このページからは登録画面(reg.html)へのボタン遷移は用意しない。
   一致した帳面が見つかったときだけ note.html へ進む。
   ============================================================ */
let BOOKS = [];
let lastScan = null;
let thTouched = false;
const cfg = { th: 0.55, mg: 0.04, auto: true };
function defaults(){ cfg.th = engine === 'mobilenet' ? 0.78 : 0.55; }

function openBook(id){ location.href = 'note.html?id=' + encodeURIComponent(id); }

function scanHTML(){
  if(!BOOKS.length) return `
    <div class="lede"><h1>読み取り</h1><p>まだ帳面が登録されていません。登録が済むと、ここで撮影した写真と全帳面の特徴ベクトルを突き合わせて照合できます。</p></div>
    <div class="panel"><div class="empty">現在照合できる帳面がありません。管理者による登録をお待ちください。</div></div>`;
  return `
  <div class="lede"><h1>読み取り</h1><p>表紙を撮ると、登録済み ${BOOKS.length} 冊すべてとコサイン類似度を計算し、閾値を超えた帳面のページを開きます。</p></div>
  <div class="cols">
    <section class="panel">
      <h2>撮影</h2>
      <div class="drop" id="drop" tabindex="0" role="button" aria-label="画像を選ぶ">
        <div class="mark">帳</div><p>表紙の写真をドラッグ、またはクリックして選択</p></div>
      <div class="btnrow" style="margin-top:12px">
        <button id="pick">画像を選ぶ</button><button id="cam">カメラで撮る</button></div>
      <input type="file" id="f1" accept="image/*" hidden><input type="file" id="f2" accept="image/*" capture="environment" hidden>
      <div class="query" id="q"><img id="qimg" alt="読み取った画像"><div class="meta" id="qmeta"></div></div>
      <div class="status" id="st"></div>
    </section>
    <section class="panel">
      <h2>類似度</h2>
      <ul class="rank" id="rank"></ul>
      <div class="empty" id="rankEmpty">まだ照合していません。</div>
      <div class="verdict" id="vd"></div>
      <div class="knobs">
        <div class="knob"><label for="th">採用の閾値(1位の類似度)<span id="thv">${cfg.th.toFixed(2)}</span></label>
          <input type="range" id="th" min="0" max="0.99" step="0.01" value="${cfg.th}"></div>
        <div class="knob"><label for="mg">1位と2位の差の下限<span id="mgv">${cfg.mg.toFixed(3)}</span></label>
          <input type="range" id="mg" min="0" max="0.3" step="0.005" value="${cfg.mg}"></div>
        <label class="toggle"><input type="checkbox" id="auto" ${cfg.auto?'checked':''}>一致したら自動でページを開く</label>
      </div>
    </section>
  </div>`;
}
function bindScan(){
  if(!BOOKS.length) return;
  const drop=$('#drop');
  drop.onclick=()=>$('#f1').click();
  drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#f1').click();}};
  $('#pick').onclick=()=>$('#f1').click(); $('#cam').onclick=()=>$('#f2').click();
  $('#f1').onchange=e=>e.target.files[0]&&scan(e.target.files[0]);
  $('#f2').onchange=e=>e.target.files[0]&&scan(e.target.files[0]);
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over')});
  drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');
    const f=e.dataTransfer.files[0];if(f)scan(f)});
  $('#th').oninput=e=>{thTouched=true;cfg.th=+e.target.value;$('#thv').textContent=cfg.th.toFixed(2);if(lastScan)decide(false)};
  $('#mg').oninput=e=>{cfg.mg=+e.target.value;$('#mgv').textContent=cfg.mg.toFixed(3);if(lastScan)decide(false)};
  $('#auto').onchange=e=>cfg.auto=e.target.checked;
  if(lastScan){ $('#qimg').src=lastScan.thumb; $('#q').classList.add('show');
    $('#qmeta').innerHTML=lastScan.meta; drawRank(); decide(false); }
}
async function scan(file){
  $('#st').textContent='照合中…';
  for(const b of BOOKS) await reembedStale(b.samples);
  const img=await loadImg(await readFile(file));
  const cv=toCanvas(img);
  const t0=performance.now();
  const q=await embed(cv);
  const scores=BOOKS.map(b=>{
    let best=-1,bi=0;
    b.samples.forEach((s,i)=>{const v=cosine(q,s.embedding);if(v>best){best=v;bi=i}});
    return {b,sim:best,si:bi};
  }).sort((a,b)=>b.sim-a.sim);
  lastScan={scores,thumb:cv.toDataURL('image/jpeg',.8),
    meta:`入力 / ${esc(file.name)}<br>次元 ${q.length} · ${Math.round(performance.now()-t0)}ms · ${engine}`};
  $('#qimg').src=lastScan.thumb; $('#q').classList.add('show'); $('#qmeta').innerHTML=lastScan.meta;
  $('#st').textContent='';
  drawRank(); decide(true);
}
function drawRank(){
  const {scores}=lastScan, ul=$('#rank'); $('#rankEmpty').style.display='none'; ul.innerHTML='';
  const max=Math.max(...scores.map(s=>Math.abs(s.sim)),1e-6);
  scores.forEach((s,i)=>{
    const li=document.createElement('li'); if(i===0)li.className='top';
    li.innerHTML=`<img src="${s.b.samples[s.si].thumb}" alt="">
      <div class="bar"><div class="nm">${esc(s.b.name)}</div><div class="track"><div class="fill"></div></div></div>
      <div class="val">${s.sim.toFixed(3)}</div>`;
    ul.appendChild(li);
    requestAnimationFrame(()=>li.querySelector('.fill').style.width=Math.max(0,s.sim/max*100).toFixed(1)+'%');
  });
}
function decide(mayNavigate){
  const {scores}=lastScan, top=scores[0], sec=scores[1];
  const gap=top.sim-(sec?sec.sim:0), pass=top.sim>=cfg.th && gap>=cfg.mg;
  const vd=$('#vd'); vd.className='verdict show '+(pass?'pass':'fail');
  vd.innerHTML = pass
    ? `一致 → <b>${esc(top.b.name)}</b><br>類似度 <b>${top.sim.toFixed(3)}</b> ≥ 閾値 <b>${cfg.th.toFixed(2)}</b> ／ 2位との差 <b>${gap.toFixed(3)}</b> ≥ <b>${cfg.mg.toFixed(3)}</b>
       <div class="btnrow" style="margin-top:10px"><button class="primary" id="opnBtn">${esc(top.b.name)} を開く</button></div>`
    : `未登録として扱う<br>${top.sim<cfg.th
        ? `1位 <b>${top.sim.toFixed(3)}</b> が閾値 <b>${cfg.th.toFixed(2)}</b> に届きません`
        : `1位と2位の差 <b>${gap.toFixed(3)}</b> が <b>${cfg.mg.toFixed(3)}</b> 未満で判断がつきません`}`;
  const ob=$('#opnBtn'); if(ob) ob.onclick=()=>openBook(top.b.id);
  if(pass && mayNavigate && cfg.auto) setTimeout(()=>openBook(top.b.id), 700);
}

(async function(){
  defaults();
  BOOKS = await store.load();
  $('#view').innerHTML = scanHTML();
  bindScan();

  /* MobileNetは裏側で読み込み、画面表示は待たせない。
     読み込み完了時点でまだ何も撮っていなければ、精度に合わせて
     閾値の初期値だけ更新する(ユーザーが手で動かしていれば触らない)。 */
  initEngine().then(async () => {
    if(!lastScan) for(const b of BOOKS) await reembedStale(b.samples);
    if(!thTouched && !lastScan){
      defaults();
      const th=$('#th'), thv=$('#thv');
      if(th){ th.value=cfg.th; thv.textContent=cfg.th.toFixed(2); }
    }
  });
})();
