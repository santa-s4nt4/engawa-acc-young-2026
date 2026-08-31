/* ============================================================
   読み取り画面 (index.html) ロジック
   このページからは登録画面(reg.html)へのボタン遷移は用意しない。
   カメラをその場で起動し、シャッターボタンで撮影 → もっとも近い
   帳面を自動で開く。類似度が低すぎるときは撮り直しを促す。
   ============================================================ */
let BOOKS = [];
let lastScan = null;
let camStream = null;
const LOW_SIM = 0.15; // これを下回ったら「うまく読み取れなかった」として撮り直しを促す

function openBook(id){ location.href = 'note.html?id=' + encodeURIComponent(id); }

function scanHTML(){
  if(!BOOKS.length) return `
    <div class="panel"><div class="empty">現在照合できる帳面がありません。管理者による登録をお待ちください。</div></div>`;
  return `
  <section class="panel">
    <h2>御朱印読み取り</h2>
    <p class="hint" style="margin-bottom:14px">神社で受け取った御朱印を、カメラ画面いっぱいに写るように撮影してください。</p>
    <div class="camwrap" id="camwrap">
      <video id="camVideo" autoplay playsinline muted></video>
      <div class="camMsg" id="camMsg"></div>
    </div>
    <div class="camControls">
      <button id="pick" class="ghost picksm">画像から選ぶ</button>
      <button id="shutter" class="shutter" aria-label="撮影" disabled><span class="dot"></span></button>
    </div>
    <div class="verdict" id="vd"></div>
    <input type="file" id="f1" accept="image/*" hidden>
    <div class="query" id="q"><img id="qimg" alt="読み取った画像"><div class="meta" id="qmeta"></div></div>
  </section>
  <div class="scanOverlay" id="scanOverlay">
    <div class="scanCard">
      <div class="txt">御神酒・奉納酒を検索中…</div>
      <div class="gauge"><div class="fill" id="scanGaugeFill"></div></div>
    </div>
  </div>`;
}
function bindScan(){
  if(!BOOKS.length) return;
  $('#pick').onclick=()=>$('#f1').click();
  $('#f1').onchange=e=>e.target.files[0]&&scan(e.target.files[0]);
  $('#shutter').onclick=()=>scanFromVideo();
  if(lastScan){ $('#qimg').src=lastScan.thumb; $('#q').classList.add('show');
    $('#qmeta').innerHTML=lastScan.meta; showMatch(false); }
  startCamera();
}

/* ---- カメラ ---- */
async function startCamera(){
  const video=$('#camVideo'), msg=$('#camMsg'), shutter=$('#shutter');
  if(!navigator.mediaDevices?.getUserMedia){
    msg.textContent='このブラウザはカメラに対応していません。「画像から選ぶ」から写真を選んでください。';
    msg.classList.add('show');
    return;
  }
  try{
    camStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false });
    video.srcObject = camStream;
    await video.play();
    msg.classList.remove('show');
    shutter.disabled = false;
  }catch(e){
    msg.textContent = 'カメラを利用できません。「画像から選ぶ」から写真を選んでください。';
    msg.classList.add('show');
    shutter.disabled = true;
  }
}
function captureFrame(video, size=224){
  const c=document.createElement('canvas'); c.width=c.height=size;
  const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,size,size);
  const vw=video.videoWidth, vh=video.videoHeight, s=Math.min(vw,vh);
  x.drawImage(video,(vw-s)/2,(vh-s)/2,s,s,0,0,size,size);
  return c;
}

/* ---- 検索中オーバーレイ — 全ボタンを覆って操作できなくする ---- */
function showOverlay(){
  const fill=$('#scanGaugeFill');
  fill.style.transition='none'; fill.style.width='0%';
  void fill.offsetWidth;
  $('#scanOverlay').classList.add('show');
}
function hideOverlay(){ $('#scanOverlay').classList.remove('show'); }
function growGauge(ms){
  const fill=$('#scanGaugeFill');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    fill.style.transition=`width ${ms}ms linear`;
    fill.style.width='100%';
  }));
}

async function scan(file){
  showOverlay();
  const img=await loadImg(await readFile(file));
  await processCanvas(toCanvas(img), file.name);
}
async function scanFromVideo(){
  showOverlay();
  await processCanvas(captureFrame($('#camVideo')), '撮影した写真');
}
async function processCanvas(cv, label){
  for(const b of BOOKS) await reembedStale(b.samples);
  const t0=performance.now();
  const q=await embed(cv);
  const scores=BOOKS.map(b=>{
    let best=-1,bi=0;
    b.samples.forEach((s,i)=>{const v=cosine(q,s.embedding);if(v>best){best=v;bi=i}});
    return {b,sim:best,si:bi};
  }).sort((a,b)=>b.sim-a.sim);
  lastScan={scores,thumb:cv.toDataURL('image/jpeg',.8),
    meta:`入力 / ${esc(label)}<br>${Math.round(performance.now()-t0)}ms`};
  $('#qimg').src=lastScan.thumb; $('#q').classList.add('show'); $('#qmeta').innerHTML=lastScan.meta;
  showMatch(true);
}
function showMatch(mayNavigate){
  const {scores}=lastScan, top=scores[0];
  const vd=$('#vd');
  if(top.sim < LOW_SIM){
    hideOverlay();
    vd.className='verdict show fail';
    vd.innerHTML = 'うまく読み取れませんでした。画角を変えるか、御朱印全体がはっきり写るように撮り直してください。';
    return;
  }
  vd.className='verdict';
  if(mayNavigate){
    showOverlay();
    growGauge(2000);
    setTimeout(()=>openBook(top.b.id), 2000);
  }
}

(async function(){
  BOOKS = await store.load();
  $('#view').innerHTML = scanHTML();
  bindScan();

  /* MobileNetは裏側で読み込み、画面表示は待たせない。 */
  initEngine().then(async () => {
    if(!lastScan) for(const b of BOOKS) await reembedStale(b.samples);
  });
})();
