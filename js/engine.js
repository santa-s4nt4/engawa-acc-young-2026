/* ============================================================
   特徴抽出エンジン — MobileNet ⇄ 内蔵簡易特徴量
   index.html(読み取り) と reg.html(登録) が読み込む。
   note.html(帳面) はベクトル計算をしないので不要。

   起動を画面表示のブロッカーにしない: ページは先に内蔵の
   簡易特徴量(engine='local')ですぐ操作可能にし、MobileNetは
   裏側で読み込んで用意でき次第差し替える。読み込み中は
   #loadbar にゲージを出す。
   ============================================================ */
const TFJS = 'https://cdnjs.cloudflare.com/ajax/libs/tensorflow/4.22.0/tf.min.js';
const MNET = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js';
let engine = 'local', mnet = null;

function loadScript(src, ms = 9000){
  return new Promise((ok, ng) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => ng(0);
    setTimeout(() => ng(0), ms);
    document.head.appendChild(s);
  });
}
function setLoadbar(pct, label, done){
  const bar = document.getElementById('loadbar');
  if(!bar) return;
  bar.innerHTML = `<span class="lb-label">${label}</span>
    <div class="lb-track"><div class="lb-fill" style="width:${pct}%"></div></div>
    <span class="lb-pct">${pct}%</span>`;
  if(done){
    bar.classList.add('done');
    setTimeout(() => bar.remove(), 450);
  }
}
async function initEngine(){
  setLoadbar(6, '準備しています', false);
  try{
    await loadScript(TFJS);
    setLoadbar(45, '読み込んでいます', false);
    await loadScript(MNET);
    setLoadbar(75, '準備しています', false);
    mnet = await window.mobilenet.load({version:2, alpha:1.0});
    engine = 'mobilenet';
    setLoadbar(100, '準備ができました', true);
  }catch(e){
    engine = 'local';
    setLoadbar(100, '準備ができました', true);
  }
  const el = document.getElementById('eng');
  if(el) el.innerHTML = engine === 'mobilenet'
    ? 'ENGINE / <b>MobileNet v2</b>' : 'ENGINE / <b>内蔵簡易特徴量</b>';
}
/* engine が起動後に切り替わっている可能性があるので、
   使う直前(スキャン実行時・保存時)に呼んでベクトルを揃え直す */
async function reembedStale(samples){
  for(const s of samples){
    if(s.engine !== engine){
      const img = await loadImg(s.thumb);
      s.embedding = await embed(toCanvas(img));
      s.engine = engine;
    }
  }
}
function l2(v){
  let n = 0; for(const x of v) n += x*x; n = Math.sqrt(n) || 1;
  const o = new Float32Array(v.length); for(let i=0;i<v.length;i++) o[i] = v[i]/n; return o;
}
function cosine(a, b){
  let s = 0, L = Math.min(a.length, b.length);
  for(let i=0;i<L;i++) s += a[i]*b[i];
  return s;
}
function localEmbedding(canvas){
  const N=64, c=document.createElement('canvas'); c.width=c.height=N;
  const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(canvas,0,0,N,N);
  const d=x.getImageData(0,0,N,N).data;
  const hue=new Float32Array(24), cell=new Float32Array(48), lum=new Float32Array(64), edge=new Float32Array(16), L=new Float32Array(N*N);
  for(let i=0,p=0;i<N*N;i++,p+=4){
    const r=d[p]/255,g=d[p+1]/255,b=d[p+2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),v=mx,s=mx?(mx-mn)/mx:0;
    let h=0; if(mx!==mn){ if(mx===r)h=((g-b)/(mx-mn)+6)%6; else if(mx===g)h=(b-r)/(mx-mn)+2; else h=(r-g)/(mx-mn)+4; h*=60; }
    hue[Math.min(23,h/15|0)]+=s*v;
    const px=i%N,py=i/N|0,ci=((py/16|0)*4+(px/16|0))*3;
    cell[ci]+=r;cell[ci+1]+=g;cell[ci+2]+=b;
    L[i]=.299*r+.587*g+.114*b; lum[(py/8|0)*8+(px/8|0)]+=L[i];
  }
  for(let y=1;y<N-1;y++)for(let q=1;q<N-1;q++){
    const gx=L[y*N+q+1]-L[y*N+q-1],gy=L[(y+1)*N+q]-L[(y-1)*N+q],m=Math.hypot(gx,gy);
    if(m<.04)continue; let a=Math.atan2(gy,gx); if(a<0)a+=Math.PI;
    edge[Math.min(15,a/Math.PI*16|0)]+=m;
  }
  const ctr=a=>{let m=0;for(const v of a)m+=v;m/=a.length;let n=0;
    for(let i=0;i<a.length;i++){a[i]-=m;n+=a[i]*a[i];}n=Math.sqrt(n)||1;
    for(let i=0;i<a.length;i++)a[i]/=n;return a;};
  const o=new Float32Array(152);
  o.set(ctr(hue),0);o.set(ctr(cell),24);o.set(ctr(lum),72);o.set(ctr(edge),136);
  return l2(o);
}
async function embed(canvas){
  if(engine === 'mobilenet'){
    const t = mnet.infer(canvas, true);
    const a = await t.data();
    t.dispose();
    return Array.from(l2(Float32Array.from(a)));
  }
  return Array.from(localEmbedding(canvas));
}

/* 画像 → 224 正方キャンバス(中央切り出し) */
function toCanvas(img, size = 224){
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0,0,size,size);
  const s = Math.min(img.width, img.height);
  x.drawImage(img, (img.width-s)/2, (img.height-s)/2, s, s, 0, 0, size, size);
  return c;
}
const loadImg = src => new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ng; i.src = src; });
const readFile = f => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
