const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const PUB=path.join(__dirname,'public'),C=40,N=100,W=C*N,DT=1/30;
const srv=http.createServer((q,r)=>{
  const u=q.url.split('?')[0],f=path.join(PUB,u==='/'?'index.html':u);
  if(!f.startsWith(PUB)){r.writeHead(403);return r.end()}
  fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end('404')}r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':'text/plain'});r.end(d)});
});
const wss=new WebSocketServer({server:srv,maxPayload:300000});
let uid=1;const rnd=(a,b)=>a+Math.random()*(b-a),ids=()=>uid++;
const P=new Map(),Z=[],WL=new Map(),CO=[],RES=[],PONDS=[],occ=new Set();
const RT={tree:{hp:10,m:'wood'},rock:{hp:15,m:'rock'},ore:{hp:25,m:'metal'}};
function scatter(k,n){for(let i=0;i<n;i++){const cx=1+Math.floor(Math.random()*(N-2)),cy=1+Math.floor(Math.random()*(N-2)),key=cx+','+cy;if(occ.has(key))continue;occ.add(key);RES.push({id:RES.length,k,x:cx*C+C/2,y:cy*C+C/2,hp:RT[k].hp,rs:0})}}
scatter('tree',420);scatter('rock',110);scatter('ore',50);
for(let i=0;i<6;i++)PONDS.push({x:rnd(300,W-300),y:rnd(300,W-300),r:90});
const wr=w=>[w.x*C,w.y*C,(w.o==='h'?2:1)*C,(w.o==='h'?1:2)*C];
const wc=w=>w.o==='h'?[[w.x,w.y],[w.x+1,w.y]]:[[w.x,w.y],[w.x,w.y+1]];
const wd=(x,y,w)=>{const[a,b,c,d]=wr(w);return Math.hypot(x-Math.max(a,Math.min(x,a+c)),y-Math.max(b,Math.min(y,b+d)))};
function blocked(x,y,r){
  if(x<r||y<r||x>W-r||y>W-r)return true;
  for(const w of WL.values())if(wd(x,y,w)<r)return true;
  for(const o of RES)if(o.hp>0&&(x-o.x)**2+(y-o.y)**2<(r+18)**2)return true;
  return false}
const move=(e,dx,dy,r)=>{if(!blocked(e.x+dx,e.y,r))e.x+=dx;if(!blocked(e.x,e.y+dy,r))e.y+=dy};
function spawnPt(){for(let i=0;i<60;i++){const x=rnd(100,W-100),y=rnd(100,W-100);if(!blocked(x,y,22))return{x,y}}return{x:W/2,y:W/2}}
const send=(ws,o)=>{if(ws.readyState===1)ws.send(typeof o==='string'?o:JSON.stringify(o))};
const all=o=>{const s=JSON.stringify(o);for(const p of P.values())send(p.ws,s)};
const note=(p,m)=>send(p.ws,{t:'n',m});
const inf=p=>({id:p.id,name:p.name,sk:p.sk,av:p.av});
const newZ=(x,y,pid)=>({id:ids(),x,y,a:0,hp:60,cd:0,pid:pid||0,tx:0,ty:0,tt:0,wa:rnd(0,6.28)});
function noise(x,y,r){const n=Date.now();for(const z of Z)if(Math.hypot(z.x-x,z.y-y)<r){z.tx=x;z.ty=y;z.tt=n+8000}}
function die(p,why,turn){
  if(!P.has(p.id))return;P.delete(p.id);p.ws.me=null;
  if(turn)Z.push(newZ(p.x,p.y,p.id));else CO.push({id:ids(),x:p.x,y:p.y,k:'p',pid:p.id,t:Date.now()});
  send(p.ws,{t:'dead',r:why});all({t:'l',id:p.id})}
const hurt=(p,d,why)=>{p.hp-=d;if(p.hp<=0)die(p,why)};
function killZ(z){Z.splice(Z.indexOf(z),1);CO.push({id:ids(),x:z.x,y:z.y,k:'z',pid:0,t:Date.now()})}
function delW(w){WL.delete(w.id);wc(w).forEach(([x,y])=>occ.delete(x+','+y));all({t:'w-',id:w.id})}
function swing(p){
  p.cd=0.6;p.sw=0.25;p.hu-=0.3;p.th-=0.3;
  const hx=p.x+Math.cos(p.a)*38,hy=p.y+Math.sin(p.a)*38;
  for(const q of P.values())if(q!==p&&Math.hypot(q.x-hx,q.y-hy)<28)return hurt(q,20,'Killed by '+p.name);
  for(const z of Z)if(Math.hypot(z.x-hx,z.y-hy)<28){z.hp-=20;if(z.hp<=0)killZ(z);return}
  for(const w of WL.values())if(wd(hx,hy,w)<6){if(--w.hp<=0)delW(w);else all({t:'wh',id:w.id,hp:w.hp});return}
  for(const o of RES)if(o.hp>0&&Math.hypot(o.x-hx,o.y-hy)<30){
    const t=RT[o.k];o.hp--;p[t.m]=Math.min(999,p[t.m]+75/t.hp);
    noise(o.x,o.y,550);if(o.hp<=0)o.rs=Date.now()+90000;
    all({t:'r',i:o.id,hp:o.hp});return}
}
function interact(p){
  const i=CO.findIndex(c=>Math.hypot(c.x-p.x,c.y-p.y)<55);
  if(i>=0){
    const c=CO.splice(i,1)[0],r=Math.random();p.hu=Math.min(100,p.hu+(c.k==='p'?40:25));
    if(r<.05){note(p,'The flesh turned you...');return die(p,'You turned into a zombie.',1)}
    if(r<.25){p.hu=Math.max(0,p.hu-30);p.th=Math.max(0,p.th-20);return note(p,'You vomited.')}
    return note(p,'You ate the flesh.')}
  if(PONDS.some(o=>Math.hypot(o.x-p.x,o.y-p.y)<o.r+35)){p.th=Math.min(100,p.th+30);note(p,'You drank water.')}
}
function place(p,m){
  const x=m.x|0,y=m.y|0,o=m.o==='v'?'v':'h',w={id:ids(),x,y,o,hp:3},cells=wc(w);
  if(p.wood<10||Math.hypot(x*C-p.x,y*C-p.y)>320)return;
  if(cells.some(([a,b])=>a<0||b<0||a>=N||b>=N||occ.has(a+','+b)))return;
  if([...P.values(),...Z].some(e=>wd(e.x,e.y,w)<24))return;
  p.wood-=10;WL.set(w.id,w);cells.forEach(([a,b])=>occ.add(a+','+b));all({t:'w+',w})}
wss.on('connection',ws=>{
  ws.on('error',()=>{});
  ws.on('message',raw=>{
    let m;try{m=JSON.parse(raw)}catch{return}
    const p=ws.me;
    if(m.t==='join'&&!p){
      const s=spawnPt(),me={id:ids(),ws,name:String(m.name||'Survivor').slice(0,16),sk:String(m.sk||'#c68642').slice(0,12),
        av:typeof m.av==='string'&&m.av.startsWith('data:image/')&&m.av.length<20000?m.av:'',
        x:s.x,y:s.y,a:0,k:0,hp:100,hu:100,th:100,wood:0,rock:0,metal:0,cd:0,sw:0,ty:0};
      ws.me=me;P.set(me.id,me);
      send(ws,{t:'w',id:me.id,W,C,res:RES.map(o=>[o.k,o.x,o.y,o.hp]),walls:[...WL.values()],ponds:PONDS,info:[...P.values()].map(inf)});
      all({t:'j',i:inf(me)});all({t:'c',n:'',m:me.name+' joined.'});
    }else if(!p)return;
    else if(m.t==='in'){p.k=m.k|0;if(Number.isFinite(m.a))p.a=m.a}
    else if(m.t==='chat'){const s=String(m.m).slice(0,140).trim();if(s)all({t:'c',n:p.name,m:s});p.ty=0}
    else if(m.t==='typ')p.ty=m.v?1:0;
    else if(m.t==='b')place(p,m);
    else if(m.t==='e')interact(p);
  });
  ws.on('close',()=>{const p=ws.me;if(p){P.delete(p.id);all({t:'l',id:p.id})}});
});
let spT=0;
setInterval(()=>{
  const now=Date.now();
  for(const p of [...P.values()]){
    const k=p.k,dx=(k&8?1:0)-(k&2?1:0),dy=(k&4?1:0)-(k&1?1:0),l=Math.hypot(dx,dy),mv=l>0;
    if(mv)move(p,dx/l*210*DT,dy/l*210*DT,18);
    p.cd-=DT;p.sw=Math.max(0,p.sw-DT);
    if(k&16&&p.cd<=0)swing(p);
    p.hu=Math.max(0,p.hu-(mv?.22:.05)*DT);p.th=Math.max(0,p.th-(mv?.28:.07)*DT);
    if(p.hu<=0||p.th<=0)hurt(p,2*DT,'You starved.');
    else if(p.hp<100&&p.hu>40&&p.th>40)p.hp=Math.min(100,p.hp+1.5*DT);
  }
  for(const z of [...Z]){
    let tg=null,bd=450;
    for(const p of P.values()){const d=Math.hypot(p.x-z.x,p.y-z.y);if(d<bd){bd=d;tg=p}}
    let dx,dy,sp=165;
    if(tg){dx=tg.x-z.x;dy=tg.y-z.y}
    else if(z.tt>now){dx=z.tx-z.x;dy=z.ty-z.y;if(Math.hypot(dx,dy)<30)z.tt=0}
    else{z.wa+=rnd(-.2,.2);dx=Math.cos(z.wa);dy=Math.sin(z.wa);sp=50}
    const l=Math.hypot(dx,dy)||1,ox=z.x,oy=z.y;z.a=Math.atan2(dy,dx);
    move(z,dx/l*sp*DT,dy/l*sp*DT,18);
    if(z.x===ox&&z.y===oy)z.wa+=2;
    z.cd-=DT;if(tg&&bd<42&&z.cd<=0){z.cd=1;hurt(tg,20,'Killed by a zombie.')}
  }
  for(const o of RES)if(o.hp<=0&&o.rs&&now>o.rs){o.hp=RT[o.k].hp;o.rs=0;all({t:'r',i:o.id,hp:o.hp})}
  for(let i=CO.length;i--;)if(now-CO[i].t>90000)CO.splice(i,1);
  spT-=DT;
  if(spT<=0){
    spT=3;
    for(let i=Z.length;i--;)if(!Z[i].pid&&![...P.values()].some(p=>Math.hypot(p.x-Z[i].x,p.y-Z[i].y)<1500))Z.splice(i,1);
    if(P.size&&Z.length<Math.min(70,10+10*P.size)){
      const t=[...P.values()][Math.random()*P.size|0],a=rnd(0,6.28),d=rnd(650,850);
      for(let i=0,n=1+(Math.random()*4|0);i<n;i++){const x=t.x+Math.cos(a)*d+rnd(-60,60),y=t.y+Math.sin(a)*d+rnd(-60,60);if(!blocked(x,y,18))Z.push(newZ(x,y))}
    }
  }
  const R=Math.round,F=v=>+v.toFixed(2);
  const s=JSON.stringify({t:'s',
    p:[...P.values()].map(p=>[p.id,R(p.x),R(p.y),F(p.a),Math.ceil(p.hp),p.ty,F(p.sw)]),
    z:Z.map(z=>[z.id,R(z.x),R(z.y),F(z.a),z.pid]),
    c:CO.map(c=>[c.id,R(c.x),R(c.y),c.k,c.pid])}).slice(0,-1);
  for(const p of P.values())send(p.ws,s+',"me":'+JSON.stringify([Math.ceil(p.hp),Math.ceil(p.hu),Math.ceil(p.th),p.wood|0,p.rock|0,p.metal|0])+'}');
},1000*DT);
srv.listen(process.env.PORT||3000,()=>console.log('MooDayZ on '+(process.env.PORT||3000)));
