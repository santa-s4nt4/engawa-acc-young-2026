/* ============================================================
   読み取り画面 (index.html) ロジック
   このページからは登録画面(reg.html)へのボタン遷移は用意しない。
   カメラをその場で起動し、シャッターボタンで撮影 → もっとも近い
   帳面を自動で開く。類似度が低すぎるときは撮り直しを促す。
   ============================================================ */
let BOOKS = [];
let lastScan = null;
let autoOpen = true;
let camStream = null;
const LOW_SIM = 0.15; // これを下回ったら「うまく読み取れなかった」として撮り直しを促す

function openBook(id){ location.href = 'note.html?id=' + encodeURIComponent(id); }

function scanHTML(){
  if(!BOOKS.length) return `
    <div class="lede"><h1>読み取り</h1><p>まだ帳面が登録されていません。登録が済むと、ここで撮影した写真と全帳面の特徴ベクトルを突き合わせて照合できます。</p></div>
    <div class="panel"><div class="empty">現在照合できる帳面がありません。管理者による登録をお待ちください。</div></div>`;
  return `
  <div class="lede"><h1>読み取り</h1><p>表紙を撮ると、登録済み ${BOOKS.length} 冊の中からもっとも近い帳面のページを開きます。</p></div>
  <section class="panel">
    <h2>撮影</h2>
    <div class="camwrap" id="camwrap">
      <video id="camVideo" autoplay playsinline muted></video>
      <div class="camMsg" id="camMsg" hidden></div>
    </div>
    <div class="camControls">
      <button id="pick" class="ghost picksm">画像から選ぶ</button>
      <button id="shutter" class="shutter" aria-label="撮影" disabled><span class="dot"></span></button>
    </div>
    <input type="file" id="f1" accept="image/*" hidden>
    <div class="query" id="q"><img id="qimg" alt="読み取った画像"><div class="meta" id="qmeta"></div></div>
    <div class="status" id="st"></div>
    <div class="verdict" id="vd"></div>
    <label class="toggle" style="margin-top:14px"><input type="checkbox" id="auto" ${autoOpen?'checked':''}>自動でページを開く</label>
  </section>`;
}
function bindScan(){
  if(!BOOKS.length) return;
  $('#pick').onclick=()=>$('#f1').click();
  $('#f1').onchange=e=>e.target.files[0]&&scan(e.target.files[0]);
  $('#shutter').onclick=()=>scanFromVideo();
  $('#auto').onchange=e=>autoOpen=e.target.checked;
  if(lastScan){ $('#qimg').src=lastScan.thumb; $('#q').classList.add('show');
    $('#qmeta').innerHTML=lastScan.meta; showMatch(false); }
  startCamera();
}

/* ---- カメラ ---- */
async function startCamera(){
  const video=$('#camVideo'), msg=$('#camMsg'), shutter=$('#shutter');
  if(!navigator.mediaDevices?.getUserMedia){
    msg.hidden=false; msg.textContent='このブラウザはカメラに対応していません。「画像から選ぶ」から写真を選んでください。';
    return;
  }
  try{
    camStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false });
    video.srcObject = camStream;
    await video.play();
    msg.hidden = true;
    shutter.disabled = false;
  }catch(e){
    msg.hidden = false;
    msg.textContent = 'カメラを利用できません。「画像から選ぶ」から写真を選んでください。';
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

async function scan(file){
  $('#st').textContent='照合中…';
  const img=await loadImg(await readFile(file));
  await processCanvas(toCanvas(img), file.name);
}
async function scanFromVideo(){
  $('#st').textContent='照合中…';
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
    meta:`入力 / ${esc(label)}<br>${Math.round(performance.now()-t0)}ms · ${engine}`};
  $('#qimg').src=lastScan.thumb; $('#q').classList.add('show'); $('#qmeta').innerHTML=lastScan.meta;
  $('#st').textContent='';
  showMatch(true);
}
function showMatch(mayNavigate){
  const {scores}=lastScan, top=scores[0];
  const vd=$('#vd');
  if(top.sim < LOW_SIM){
    vd.className='verdict show fail';
    vd.innerHTML = 'うまく読み取れませんでした。画角を変えるか、御朱印全体がはっきり写るように撮り直してください。';
    return;
  }
  vd.className='verdict show pass';
  vd.innerHTML = `<b>${esc(top.b.name)}</b> を開きます…
     <div class="btnrow" style="margin-top:10px"><button class="primary" id="opnBtn">今すぐ開く</button></div>`;
  const ob=$('#opnBtn'); if(ob) ob.onclick=()=>openBook(top.b.id);
  if(mayNavigate && autoOpen) setTimeout(()=>openBook(top.b.id), 700);
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
