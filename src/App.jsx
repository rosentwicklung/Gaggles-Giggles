import React, { useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
//  HATCH RUN  v2.0
// ═══════════════════════════════════════════════════════════════════════════════

const STAGES = [
  { emoji:'🥚', name:'Egg',     speed:0,   jumpForce:0,   gravity:0.55, flaps:0, color:'#f5e642' },
  { emoji:'🐥', name:'Chick',   speed:4,   jumpForce:-10, gravity:0.55, flaps:1, color:'#ffe066' },
  { emoji:'🐔', name:'Chicken', speed:5.5, jumpForce:-12, gravity:0.58, flaps:1, color:'#ff9f43' },
  { emoji:'🦃', name:'Turkey',  speed:7.5, jumpForce:-12, gravity:0.42, flaps:3, color:'#c0392b' },
  { emoji:'🦅', name:'Eagle',   speed:11,  jumpForce:-15, gravity:0.65, flaps:3, color:'#2980b9' },
];
const EVOLVE_AT   = [0, 3, 7, 12, 18];   // seeds needed at each stage to evolve
const SEED_WORTH  = { plant:1, corn:2 };
const TRIFOIL_WORTH = 3;

const WORLDS = [
  {
    name:'Meadow',
    skyTop:[100,185,230], skyBot:[175,225,255],
    gndTop:[60,179,113],  gndBot:[144,238,144],
    fog:[255,255,255,0],
    far:['🏔️','⛰️','🗻'],
    mid:['🌲','🌳','🏡','🏠','🌲','🌳','🏘️'],
    near:['🌿','🌼','🌷','🪨','🌾','🌸','🍀'],
  },
  {
    name:'Farm',
    skyTop:[220,140,60],  skyBot:[255,200,110],
    gndTop:[139,110,50],  gndBot:[200,180,90],
    fog:[255,200,100,0.06],
    far:['🏔️','⛰️','🌄'],
    mid:['🚜','🏚️','🌾','🏠','🚜','🌻','🏗️'],
    near:['🌾','🌻','🪨','🌿','🪴','🌾','🪵'],
  },
  {
    name:'Forest',
    skyTop:[5,5,28],      skyBot:[20,10,60],
    gndTop:[0,80,0],      gndBot:[30,120,30],
    fog:[10,0,40,0.12],
    far:['🌲','🌲','🌲'],
    mid:['🌲','🌲','🏚️','🌲','🌲','🕌'],
    near:['🍄','🌿','🪨','🌿','🍄','🌿','🪸'],
  },
];

const WEATHER = [
  { at:0,   id:'clear',        rain:0,   storm:false, dark:[0,0,0,0]        },
  { at:200, id:'overcast',     rain:0,   storm:false, dark:[20,20,45,0.22]  },
  { at:350, id:'rain',         rain:1,   storm:false, dark:[20,20,60,0.36]  },
  { at:500, id:'thunderstorm', rain:1.6, storm:true,  dark:[5,5,25,0.58]    },
];

const GY  = 310;             // horizon y (top of ground)
const PY  = GY + 60;         // player center y (grounded)
const CW  = 800;
const CH  = 450;
const TAU = Math.PI * 2;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const lerp     = (a,b,t) => a + (b-a)*t;
const clamp    = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const lerpRGB  = (c1,c2,t) => c1.map((v,i)=>Math.round(lerp(v,c2[i],t)));
const cssRGB   = ([r,g,b]) => `rgb(${r},${g},${b})`;
const cssRGBA  = ([r,g,b,a]) => `rgba(${r},${g},${b},${a})`;
const pick     = a => a[Math.floor(Math.random()*a.length)];
const rnd      = (lo,hi) => lo + Math.random()*(hi-lo);
const sign     = v => (v>=0?1:-1);

const makeLayer = (n, gap, arr) =>
  Array.from({length:n},(_,i)=>({
    x: i*gap + rnd(0,gap*0.5),
    emoji: pick(arr),
    phase: rnd(0,TAU),
  }));

const makeClouds = n => Array.from({length:n},()=>({
  x: rnd(0,CW), y: rnd(15,120),
  w: rnd(0.6,1.2), spd: rnd(0.12,0.4),
  alpha: rnd(0.5,0.9),
}));

const makeRain = n => Array.from({length:n},()=>({
  x: rnd(0,CW), y: rnd(0,CH),
  len: rnd(7,18), spd: rnd(6,12),
  alpha: rnd(0.15,0.45),
}));

const makeWind = n => Array.from({length:n},()=>({
  x: rnd(0,CW), y: rnd(0,CH),
  len: rnd(10,30), spd: rnd(0.5,2),
  alpha: rnd(0.03,0.18),
}));

const makeStars = n => Array.from({length:n},()=>({
  x: rnd(0,CW), y: rnd(0,GY*0.85),
  r: rnd(0.8,2.2), phase: rnd(0,TAU),
}));

const makeState = () => ({
  stage:0, seedsCollected:0,
  cornCount:0, plantCount:0, trifoilCount:0,
  score:0, combo:1, comboTimer:0,
  distance:0,
  worldIdx:0, worldT:0, worldTarget:0, transitioning:false,
  speed:0, isCrashed:false, crashTimer:0, frameCount:0,
  weatherIdx:0, lightningTimer:90, lightningAlpha:0,
  sunAngle: Math.PI * 0.15,  // start: sun just risen left
  shakeX:0, shakeY:0, shakeLife:0,
  evolutionFlash:0,

  player:{ x:150, y:PY, vy:0, rotation:0, flapCount:0,
           scaleX:1, scaleY:1, tSX:1, tSY:1 },

  objects:[], particles:[], floats:[],
  clouds:    makeClouds(8),
  rainDrops: makeRain(160),
  windParts: makeWind(30),
  stars:     makeStars(80),
  farLayer:  makeLayer(4, 250, WORLDS[0].far),
  midLayer:  makeLayer(8, 120, WORLDS[0].mid),
  nearLayer: makeLayer(14, 80, WORLDS[0].near),
});

// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const canvasRef = useRef(null);

  useEffect(()=>{
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const dpr    = window.devicePixelRatio || 1;
    canvas.width  = CW*dpr; canvas.height = CH*dpr;
    ctx.scale(dpr,dpr);
    canvas.style.width = `${CW}px`; canvas.style.height = `${CH}px`;

    // ── Persistent best score ──────────────────────────────────────────────────
    const getBest = () => { try { return parseInt(localStorage.getItem('hr_best_v2')||'0'); } catch{return 0;} };
    const setBest = v => { try { localStorage.setItem('hr_best_v2',String(v)); } catch{} };

    // ── Game mode: 'title' | 'playing' | 'dead' ────────────────────────────────
    let mode = 'title';
    let titleFrame = 0;
    let state = makeState();
    let raf;

    // ── Particle helpers ───────────────────────────────────────────────────────
    const burst = (x,y,emoji,n=6,fast=false) => {
      for(let i=0;i<n;i++) state.particles.push({
        x, y,
        vx: rnd(-1,1)*(fast?14:9),
        vy: rnd(-1.2,0.1)*(fast?12:8),
        emoji, life:1,
        size: rnd(13,fast?26:22),
      });
    };

    const floatText = (x,y,text,color='#fff',size=22) => {
      state.floats.push({ x, y, text, color, size, life:1, vy:-1.4 });
    };

    // ── Spawn helpers ──────────────────────────────────────────────────────────
    const spawnTrifoil = () => {
      state.objects.push({
        id:Math.random(), x:CW+80, active:true,
        type:'trifoil', emoji:'🍀',
        y: PY - rnd(170,240),
        radius:20, phase:rnd(0,TAU), glowPhase:rnd(0,TAU),
      });
    };

    const spawnObject = () => {
      if(state.isCrashed || state.stage===0) return;
      if(Math.random()<0.045){ spawnTrifoil(); return; }

      const r = Math.random();
      let type = r<0.65 ? 'seed' : r<0.88 ? 'log' : 'fence';
      if(type==='fence' && state.stage<2) type = 'seed';

      const obj = { id:Math.random(), x:CW+80, active:true, phase:rnd(0,TAU) };
      if(type==='seed'){
        const corn = Math.random()>0.48;
        Object.assign(obj,{
          type:'seed', seedType: corn?'corn':'plant',
          emoji: corn?'🌽':'🌱',
          y: Math.random()>0.45 ? PY : PY-88,
          radius:18,
        });
      } else if(type==='log'){
        Object.assign(obj,{type:'log', emoji:'🪵', y:PY-6, radius:24});
      } else {
        Object.assign(obj,{type:'fence', emoji:'🚧', y:PY-2, radius:34});
      }
      state.objects.push(obj);
    };

    const resetState = () => { state = makeState(); };

    // ── Input ──────────────────────────────────────────────────────────────────
    const handleTap = () => {
      if(mode==='title'){
        mode='playing';
        state = makeState();
        state.stage=1;
        state.speed=STAGES[1].speed;
        burst(state.player.x, state.player.y,'✨',14);
        return;
      }
      if(mode==='dead'){
        if(state.crashTimer>55){
          mode='playing';
          state = makeState();
          state.stage=1;
          state.speed=STAGES[1].speed;
          burst(state.player.x, state.player.y,'✨',14);
        }
        return;
      }
      // playing
      if(state.isCrashed) return;
      const s = STAGES[state.stage], p = state.player;
      if(p.y >= PY-4){
        p.vy = s.jumpForce; p.flapCount=1;
        p.tSX=0.90; p.tSY=1.14;
        burst(p.x, p.y+18,'💨',3);
      } else if(p.flapCount < s.flaps){
        p.vy = s.jumpForce*0.8; p.flapCount++;
        p.tSX=0.92; p.tSY=1.10;
        burst(p.x, p.y+14,'🪶',3);
      }
    };

    const onMouse  = e => { e.preventDefault(); handleTap(); };
    const onKey    = e => { if(e.code==='Space'||e.code==='ArrowUp') handleTap(); };
    canvas.addEventListener('mousedown',  onMouse);
    canvas.addEventListener('touchstart', onMouse, {passive:false});
    window.addEventListener('keydown',    onKey);

    // ── UPDATE ─────────────────────────────────────────────────────────────────
    const update = () => {
      if(mode==='title'){ titleFrame++; return; }

      const f = ++state.frameCount;
      const st = STAGES[state.stage];
      const p  = state.player;

      // Sun angle
      state.sunAngle += 0.0032;

      // World transition
      const wTgt = state.stage<=1?0 : state.stage<=3?1 : 2;
      if(wTgt !== state.worldTarget){ state.worldTarget=wTgt; state.worldT=0; }
      if(state.worldIdx !== state.worldTarget){
        state.worldT = Math.min(1, state.worldT+0.006);
        if(state.worldT>=1){ state.worldIdx=state.worldTarget; state.worldT=0; spawnTrifoil(); }
      }
      state.transitioning = state.worldIdx !== state.worldTarget;

      // Weather
      let wIdx=0;
      for(let i=0;i<WEATHER.length;i++) if(state.distance>=WEATHER[i].at) wIdx=i;
      state.weatherIdx = wIdx;
      const W = WEATHER[wIdx];
      if(W.storm){
        if(--state.lightningTimer<=0){
          state.lightningTimer = Math.floor(rnd(80,200));
          state.lightningAlpha = 1;
        }
      }
      state.lightningAlpha = Math.max(0, state.lightningAlpha-0.07);

      // Screen shake decay
      if(state.shakeLife>0){
        state.shakeLife--;
        const mag = state.shakeLife*0.4;
        state.shakeX = rnd(-mag,mag);
        state.shakeY = rnd(-mag,mag);
      } else { state.shakeX=0; state.shakeY=0; }

      // Evolution flash decay
      state.evolutionFlash = Math.max(0, state.evolutionFlash-0.06);

      // Combo timer
      if(state.comboTimer>0){ state.comboTimer--; if(state.comboTimer===0) state.combo=1; }

      // Player physics
      if(!state.isCrashed){
        p.vy += st.gravity; p.y += p.vy;
        if(p.y >= PY){
          p.scaleX=1; p.scaleY=1; p.tSX=1; p.tSY=1;
          p.y=PY; p.vy=0; p.flapCount=0;
        } else {
          p.scaleX += (p.tSX-p.scaleX)*0.28;
          p.scaleY += (p.tSY-p.scaleY)*0.28;
          if(Math.abs(p.tSX-1)<0.025){ p.tSX=1; p.tSY=1; }
        }
        if(state.stage>0) state.distance += state.speed*0.022;
        state.score = Math.floor(state.distance * state.combo);
      } else {
        p.vy+=0.55; p.y+=p.vy; p.x+=2; p.rotation+=0.1;
        state.crashTimer++;
        if(state.crashTimer===56) mode='dead';
      }

      // Spawn
      if(state.stage>0 && f % Math.max(52,135-state.speed*7) === 0) spawnObject();

      // Collisions
      const req = EVOLVE_AT[state.stage] || 3;
      for(let i=state.objects.length-1;i>=0;i--){
        const obj = state.objects[i];
        if(!obj.active) continue;
        obj.x -= state.speed;
        if(!state.isCrashed){
          const dx=p.x-obj.x, dy=p.y-obj.y;
          if(Math.sqrt(dx*dx+dy*dy) < obj.radius + 18){
            if(obj.type==='seed' || obj.type==='trifoil'){
              obj.active=false;
              const worth = obj.type==='trifoil' ? TRIFOIL_WORTH
                          : SEED_WORTH[obj.seedType]||1;
              // Combo
              state.combo = clamp(state.combo + Math.ceil(worth/2), 1, 8);
              state.comboTimer = 120;
              state.seedsCollected = Math.min(state.seedsCollected+worth, req);
              if(obj.type==='trifoil'){ state.trifoilCount++; burst(obj.x,obj.y,'🍀',10,true); burst(obj.x,obj.y,'⭐',6,true); }
              else if(obj.seedType==='corn'){ state.cornCount++; burst(obj.x,obj.y,'✨',5); }
              else { state.plantCount++; burst(obj.x,obj.y,'✨',4); }
              floatText(obj.x, obj.y-20,
                obj.type==='trifoil' ? '+3 ✨' : obj.seedType==='corn' ? '+2' : '+1',
                obj.type==='trifoil' ? '#5aff8a' : obj.seedType==='corn' ? '#FFD700' : '#a8ff78');
              if(state.combo>1) floatText(obj.x+30, obj.y-44, `×${state.combo}`, '#ff9f43', 18);

              if(state.seedsCollected>=req){
                state.seedsCollected=0;
                if(state.stage<STAGES.length-1){
                  state.stage++;
                  state.speed=STAGES[state.stage].speed;
                  state.evolutionFlash=1;
                  burst(p.x,p.y,'🌟',20,true);
                  burst(p.x,p.y,'✨',16,true);
                  floatText(p.x, p.y-60, `EVOLVED! ${STAGES[state.stage].emoji}`, '#FFD700', 26);
                } else {
                  state.speed=Math.min(state.speed+0.4,18);
                  burst(p.x,p.y,'🎉',20,true);
                  floatText(p.x, p.y-60, 'MAX SPEED!', '#ff6b6b', 26);
                }
              }
            } else {
              state.isCrashed=true; p.vy=-10;
              state.shakeLife=18;
              state.combo=1;
              burst(p.x,p.y,'💫',14,true);
              const final = Math.floor(state.distance * 1);
              if(final > getBest()) setBest(final);
            }
          }
        }
        if(obj.x < -120) state.objects.splice(i,1);
      }

      // Particles
      for(let i=state.particles.length-1;i>=0;i--){
        const pt=state.particles[i];
        pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.2; pt.life-=0.024;
        if(pt.life<=0) state.particles.splice(i,1);
      }
      // Float texts
      for(let i=state.floats.length-1;i>=0;i--){
        const ft=state.floats[i];
        ft.y+=ft.vy; ft.life-=0.022;
        if(ft.life<=0) state.floats.splice(i,1);
      }

      // Environment
      state.clouds.forEach(c=>{
        c.x -= c.spd*(1+state.speed*0.05);
        if(c.x<-150){ c.x=CW+150; c.y=rnd(15,120); c.w=rnd(0.6,1.2); }
      });
      if(W.rain>0) state.rainDrops.forEach(r=>{
        r.y+=r.spd; r.x-=r.spd*0.22;
        if(r.y>CH){ r.y=-10; r.x=rnd(0,CW); }
      });
      const windI=Math.max(0,(state.speed-4)/10);
      if(windI>0) state.windParts.forEach(wp=>{
        wp.x -= wp.spd*(state.speed*0.4);
        if(wp.x<-60){ wp.x=CW+60; wp.y=rnd(0,CH); }
      });
      const WD = WORLDS[state.worldIdx];
      const upd = (layer,spd,arr)=>layer.forEach(it=>{
        it.x-=state.speed*spd;
        if(it.x<-300){ it.x=CW+300; it.emoji=pick(arr); }
      });
      upd(state.farLayer,  0.5,  WD.far);
      upd(state.midLayer,  0.5,  WD.mid);
      upd(state.nearLayer, 1.25, WD.near);
    };

    // ── DRAW HELPERS ───────────────────────────────────────────────────────────
    const roundRect = (x,y,w,h,r) => {
      ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill();
    };

    const pill = (cx,cy,w,h,fill,stroke)=>{
      ctx.fillStyle=fill;
      if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=2; }
      ctx.beginPath(); ctx.roundRect(cx-w/2,cy-h/2,w,h,h/2);
      ctx.fill(); if(stroke) ctx.stroke();
    };

    // ── DRAW TITLE ─────────────────────────────────────────────────────────────
    const drawTitle = () => {
      const f = titleFrame;
      const best = getBest();

      // Deep night gradient
      const bg = ctx.createLinearGradient(0,0,0,CH);
      bg.addColorStop(0,'#06040f');
      bg.addColorStop(0.6,'#1a0a3a');
      bg.addColorStop(1,'#0d2e10');
      ctx.fillStyle=bg;
      ctx.fillRect(0,0,CW,CH);

      // Stars
      ctx.textAlign='center'; ctx.textBaseline='middle';
      state.stars.forEach(s=>{
        const twinkle=0.4+0.6*Math.abs(Math.sin(f*0.025+s.phase));
        ctx.fillStyle=`rgba(255,255,255,${twinkle})`;
        ctx.beginPath();
        ctx.arc(s.x,s.y,s.r,0,TAU);
        ctx.fill();
      });

      // Ground silhouette
      ctx.fillStyle='#0a1f0a';
      ctx.fillRect(0,GY+14,CW,CH);
      ctx.fillStyle='#103310';
      ctx.fillRect(0,GY+14,CW,8);

      // Tree silhouettes
      ctx.font='90px Arial';
      ctx.globalAlpha=0.18;
      [50,180,320,500,650,760].forEach((x,i)=>{
        ctx.fillText(i%2===0?'🌲':'🌳',x,GY+5);
      });
      ctx.globalAlpha=1;

      // Moon
      ctx.save();
      ctx.translate(CW*0.82, 70);
      ctx.rotate(f*0.002);
      ctx.font='52px Arial';
      ctx.globalAlpha=0.88;
      ctx.fillText('🌕',0,0);
      ctx.restore();
      ctx.globalAlpha=1;

      // Title glow backing
      ctx.save();
      ctx.shadowColor='rgba(255,200,30,0.7)';
      ctx.shadowBlur=40;
      ctx.font='bold 64px Georgia, serif';
      ctx.fillStyle='#FFD700';
      ctx.fillText('HATCH RUN', CW/2, 110);
      ctx.restore();

      // Subtitle
      ctx.font='italic 18px Georgia, serif';
      ctx.fillStyle='rgba(255,255,255,0.5)';
      ctx.fillText('tap · click · space to evolve', CW/2, 140);

      // Egg — bouncing with rotation
      const eggBounce = Math.abs(Math.sin(f*0.06))*14;
      const eggRot    = Math.sin(f*0.04)*0.18;
      ctx.save();
      ctx.translate(CW/2, 230-eggBounce);
      ctx.rotate(eggRot);
      ctx.font='90px Arial';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🥚',0,0);
      ctx.restore();

      // Evolution chain preview
      const chainY = 320;
      const chainW = (STAGES.length-1)*72;
      const cx0    = CW/2 - chainW/2;
      STAGES.forEach((s,i)=>{
        if(i===0) return;
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.35*Math.abs(Math.sin(f*0.04+i*0.7));
        ctx.font='36px Arial';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(s.emoji, cx0+(i-1)*72, chainY);
        ctx.restore();
        if(i<STAGES.length-1){
          ctx.fillStyle='rgba(255,255,255,0.18)';
          ctx.fillRect(cx0+(i-1)*72+22,chainY-2,28,4);
        }
      });

      // Best score badge
      if(best>0){
        ctx.save();
        ctx.fillStyle='rgba(255,215,0,0.15)';
        roundRect(CW/2-70,348,140,28,14);
        ctx.font='bold 14px "Courier New",monospace';
        ctx.fillStyle='#FFD700';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(`BEST  ${best}`, CW/2, 362);
        ctx.restore();
      }

      // TAP prompt
      const tapAlpha = 0.5+0.5*Math.abs(Math.sin(f*0.08));
      ctx.globalAlpha=tapAlpha;
      ctx.font='bold 20px Georgia, serif';
      ctx.fillStyle='#ffffff';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('TAP TO HATCH', CW/2, 408);
      ctx.globalAlpha=1;
    };

    // ── DRAW GAME ──────────────────────────────────────────────────────────────
    const drawGame = () => {
      const f = state.frameCount;
      const WC= WORLDS[state.worldIdx], WN=WORLDS[state.worldTarget];
      const wb= state.worldT;
      const W = WEATHER[state.weatherIdx];

      // Blend world colors
      const blendC = (a,b)=>lerpRGB(a,b,wb);

      // ── Day/night sky ──
      const halfIdx  = Math.floor(state.sunAngle/Math.PI);
      const isDay    = halfIdx%2===0;
      const arcPos   = state.sunAngle%Math.PI;
      const arcT     = arcPos/Math.PI;
      const arcH     = Math.sin(arcPos);
      const horizonT = Math.max(0, 1-arcH*3.5);
      const nightT   = isDay ? 0 : clamp(arcH*2+0.1,0,1);

      const skyTC = blendC(WC.skyTop, WN.skyTop);
      const skyBC = blendC(WC.skyBot, WN.skyBot);
      const nightTC= [5,5,28], nightBC=[20,10,60];
      const dawnTC = [255,120,40], dawnBC=[255,190,80];

      const lH=(a,b,t)=>cssRGB(lerpRGB(a,b,t));
      const finalT = nightT>0 ? lH(skyTC,nightTC,nightT) : lH(skyTC,dawnTC,horizonT*0.65);
      const finalB = nightT>0 ? lH(skyBC,nightBC,nightT) : lH(skyBC,dawnBC,horizonT*0.55);

      const skyGrad=ctx.createLinearGradient(0,0,0,GY);
      skyGrad.addColorStop(0,finalT);
      skyGrad.addColorStop(1,finalB);
      ctx.fillStyle=skyGrad;
      ctx.fillRect(0,0,CW,GY);
      ctx.fillStyle=finalB;
      ctx.fillRect(0,GY,CW,CH-GY);

      // Weather overlay
      const dd=W.dark;
      if(dd[3]>0){ ctx.fillStyle=cssRGBA(dd); ctx.fillRect(0,0,CW,CH); }
      // World fog
      if(WC.fog[3]>0){ ctx.fillStyle=cssRGBA(blendC(WC.fog,WN.fog).concat ? cssRGBA([...WC.fog]) : cssRGBA(WC.fog)); ctx.fillRect(0,0,CW,CH); }
      if(state.transitioning){ ctx.fillStyle=`rgba(255,255,240,${Math.sin(f*0.2)*0.05+0.05})`; ctx.fillRect(0,0,CW,CH); }
      if(state.lightningAlpha>0){ ctx.fillStyle=`rgba(210,230,255,${state.lightningAlpha*0.6})`; ctx.fillRect(0,0,CW,CH); }
      if(state.evolutionFlash>0){ ctx.fillStyle=`rgba(255,255,200,${state.evolutionFlash*0.55})`; ctx.fillRect(0,0,CW,CH); }

      ctx.textAlign='center'; ctx.textBaseline='middle';

      // Stars (night only)
      if(nightT>0.1){
        state.stars.forEach(s=>{
          const tw=nightT*(0.35+0.65*Math.abs(Math.sin(f*0.02+s.phase)));
          ctx.fillStyle=`rgba(255,255,255,${tw})`;
          ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,TAU); ctx.fill();
        });
      }

      // Sun / Moon
      const celX = 50 + arcT*(CW-100);
      const celY = GY*0.78 - arcH*GY*0.64;
      ctx.save();
      ctx.translate(celX,celY);
      ctx.rotate(state.sunAngle*0.25);
      ctx.font = isDay ? '56px Arial' : '48px Arial';
      ctx.globalAlpha = 0.82+arcH*0.15;
      ctx.fillText(isDay?'☀️':'🌕',0,0);
      ctx.restore();
      ctx.globalAlpha=1;

      // Wind streaks
      const windI=Math.max(0,(state.speed-4)/10);
      if(windI>0){
        ctx.save();
        state.windParts.forEach(wp=>{
          ctx.strokeStyle=`rgba(255,255,255,${wp.alpha*windI})`;
          ctx.lineWidth=0.8;
          ctx.beginPath();
          ctx.moveTo(wp.x,wp.y);
          ctx.lineTo(wp.x+wp.len*windI*2,wp.y+0.5);
          ctx.stroke();
        });
        ctx.restore();
      }

      // Clouds
      state.clouds.forEach(c=>{
        ctx.save();
        ctx.font=`${Math.round(55*c.w)}px Arial`;
        ctx.globalAlpha=c.alpha*(W.id==='thunderstorm'?0.4:1)*(nightT>0?0.5:1);
        ctx.fillText('☁️',c.x,c.y);
        ctx.restore();
      });
      ctx.globalAlpha=1;

      // FAR layer – mountains (bottom-aligned to horizon)
      ctx.globalAlpha=0.28;
      ctx.font='200px Arial';
      ctx.textBaseline='bottom';
      state.farLayer.forEach(it=>ctx.fillText(it.emoji,it.x,GY+4));
      ctx.globalAlpha=1;

      // MID layer – buildings/trees (bottom-aligned to horizon)
      ctx.globalAlpha=0.85;
      ctx.font='82px Arial';
      ctx.textBaseline='bottom';
      state.midLayer.forEach(it=>ctx.fillText(it.emoji,it.x,GY+4));
      ctx.globalAlpha=1;
      ctx.textBaseline='middle';

      // Ground
      const gA=cssRGB(blendC(WC.gndTop,WN.gndTop));
      const gB=cssRGB(blendC(WC.gndBot,WN.gndBot));
      ctx.fillStyle='#2a5a7a';
      ctx.fillRect(0,GY,CW,6);
      ctx.fillStyle=gA;
      ctx.fillRect(0,GY+6,CW,12);
      ctx.fillStyle=gB;
      ctx.fillRect(0,GY+18,CW,CH-GY-18);

      // Ground grain lines
      ctx.save();
      ctx.strokeStyle='rgba(0,0,0,0.06)';
      ctx.lineWidth=1;
      for(let ly=GY+22;ly<CH;ly+=14){
        ctx.beginPath();
        ctx.moveTo(0,ly); ctx.lineTo(CW,ly);
        ctx.stroke();
      }
      ctx.restore();

      // Player shadow
      {
        const p=state.player;
        const shadowScale = clamp((PY-p.y)/90, 0.3, 1);
        ctx.save();
        ctx.globalAlpha=0.18*shadowScale;
        ctx.fillStyle='#000';
        ctx.beginPath();
        ctx.ellipse(p.x, PY+12, 24*shadowScale, 6*shadowScale, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      // Player
      {
        const p=state.player;
        ctx.save();
        ctx.translate(p.x+state.shakeX, p.y+state.shakeY);
        if(p.rotation) ctx.rotate(p.rotation);
        ctx.scale(-p.scaleX, p.scaleY);
        ctx.font='56px Arial';
        ctx.fillText(STAGES[state.stage].emoji,0,0);
        ctx.restore();
      }

      // NEAR layer – flowers/stones in front of player
      ctx.font='34px Arial';
      ctx.textBaseline='bottom';
      state.nearLayer.forEach(it=>ctx.fillText(it.emoji,it.x,GY+30));
      ctx.textBaseline='middle';

      // Rain
      if(W.rain>0){
        ctx.save();
        state.rainDrops.forEach(r=>{
          ctx.strokeStyle=`rgba(170,200,255,${r.alpha*Math.min(W.rain,1)})`;
          ctx.lineWidth = W.rain>1 ? 1.5 : 1;
          ctx.beginPath();
          ctx.moveTo(r.x,r.y);
          ctx.lineTo(r.x-r.len*0.2,r.y+r.len);
          ctx.stroke();
        });
        ctx.restore();
      }

      // Obstacles & trifoil
      state.objects.forEach(obj=>{
        if(!obj.active) return;
        const isTri=obj.type==='trifoil';
        const bob = isTri ? Math.sin(f*0.06+obj.phase)*7
                  : obj.type==='seed' ? Math.sin(f*0.07+obj.phase)*4 : 0;
        ctx.save();
        if(isTri){
          const glow=Math.abs(Math.sin(f*0.08+obj.glowPhase));
          ctx.shadowColor=`rgba(40,255,100,${0.55+glow*0.4})`;
          ctx.shadowBlur=20+glow*12;
          ctx.globalAlpha=0.85+glow*0.15;
          ctx.font='42px Arial';
        } else {
          ctx.font=`${obj.radius*2.2}px Arial`;
        }
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(obj.emoji, obj.x, obj.y+bob);
        ctx.restore();
      });

      // Particles
      state.particles.forEach(pt=>{
        ctx.globalAlpha=Math.max(0,pt.life);
        ctx.font=`${pt.size}px Arial`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(pt.emoji,pt.x,pt.y);
      });
      ctx.globalAlpha=1;

      // Float texts
      state.floats.forEach(ft=>{
        ctx.globalAlpha=Math.max(0,ft.life);
        ctx.font=`bold ${ft.size}px "Courier New",monospace`;
        ctx.fillStyle=ft.color;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        // Text shadow
        ctx.shadowColor='rgba(0,0,0,0.6)';
        ctx.shadowBlur=4;
        ctx.fillText(ft.text,ft.x,ft.y);
        ctx.shadowBlur=0;
      });
      ctx.globalAlpha=1;

      // ── HUD ──────────────────────────────────────────────────────────────────

      // Evolution chain (top center)
      const evY=38, evX0=CW/2-(STAGES.length*64)/2+32;
      STAGES.forEach((s,i)=>{
        ctx.save();
        if(i===state.stage){
          ctx.globalAlpha=1;
          const pulse=1+Math.sin(f*0.13)*0.07;
          ctx.font='44px Arial';
          ctx.scale(pulse,pulse);
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(s.emoji,(evX0+i*64)/pulse,evY/pulse);
        } else {
          ctx.globalAlpha=i<state.stage?0.55:0.12;
          ctx.font='34px Arial';
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(s.emoji,evX0+i*64,evY);
        }
        ctx.restore();
        // Arrow between stages
        if(i<STAGES.length-1){
          ctx.globalAlpha=i<state.stage?0.45:0.10;
          ctx.fillStyle='#fff';
          ctx.font='14px Arial';
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText('›',evX0+i*64+38,evY+2);
          ctx.globalAlpha=1;
        }
      });

      // Progress bar (below chain)
      if(state.stage>0 && !state.isCrashed){
        const req=EVOLVE_AT[state.stage]||3;
        const prog=state.seedsCollected/req;
        const bW=200, bH=10, bX=CW/2-bW/2, bY=68;
        // Track
        ctx.fillStyle='rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.roundRect(bX,bY,bW,bH,5); ctx.fill();
        // Fill
        if(prog>0){
          const stC=STAGES[state.stage].color;
          const grad=ctx.createLinearGradient(bX,0,bX+bW,0);
          grad.addColorStop(0,stC); grad.addColorStop(1,'#fff');
          ctx.fillStyle=grad;
          ctx.beginPath(); ctx.roundRect(bX,bY,bW*prog,bH,5); ctx.fill();
          // Shimmer on fill edge
          ctx.save();
          ctx.globalAlpha=0.5+0.5*Math.abs(Math.sin(f*0.15));
          ctx.fillStyle='rgba(255,255,255,0.7)';
          ctx.beginPath(); ctx.roundRect(bX+bW*prog-3,bY,4,bH,2); ctx.fill();
          ctx.restore();
        }
        // Seed count label
        ctx.font='bold 11px "Courier New",monospace';
        ctx.fillStyle='rgba(255,255,255,0.6)';
        ctx.textAlign='center'; ctx.textBaseline='top';
        ctx.fillText(`${state.seedsCollected} / ${req}`, CW/2, bY+bH+3);
        ctx.textBaseline='middle';
      }

      // Score (top right)
      if(state.stage>0 && !state.isCrashed){
        const sc=`${Math.floor(state.distance)}`;
        ctx.textAlign='right'; ctx.textBaseline='top';
        ctx.font='bold 22px "Courier New",monospace';
        ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=6;
        ctx.fillStyle='#fff';
        ctx.fillText(sc, CW-16, 14);
        ctx.shadowBlur=0;
        const wBadge=W.id==='thunderstorm'?'⛈️':W.id==='rain'?'🌧️':W.id==='overcast'?'☁️':'';
        if(wBadge){ ctx.font='20px Arial'; ctx.fillText(wBadge, CW-14, 40); }
        ctx.textBaseline='middle';
      }

      // Combo (top left, only when >1)
      if(state.combo>1 && state.comboTimer>0 && !state.isCrashed){
        const alpha=Math.min(1,state.comboTimer/30);
        ctx.save();
        ctx.globalAlpha=alpha;
        ctx.fillStyle='rgba(255,120,30,0.85)';
        ctx.beginPath(); ctx.roundRect(12,10,76,32,16); ctx.fill();
        ctx.font='bold 18px "Courier New",monospace';
        ctx.fillStyle='#fff';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(`×${state.combo} COMBO`, 50, 26);
        ctx.restore();
      }

    };

    // ── DRAW DEAD / SUMMARY ────────────────────────────────────────────────────
    const drawDead = () => {
      const f = state.frameCount;
      drawGame();

      // Overlay
      ctx.fillStyle='rgba(0,0,0,0.65)';
      ctx.fillRect(0,0,CW,CH);

      const dist   = Math.floor(state.distance);
      const total  = Math.round(dist + state.plantCount*dist*1 + state.cornCount*dist*1.5 + state.trifoilCount*dist*3);
      const best   = getBest();
      const isNew  = total >= best && total > 0;
      if(isNew) setBest(total);
      const hasTri = state.trifoilCount > 0;
      const cH     = 290 + (hasTri ? 52 : 0) + (isNew ? 32 : 0);
      const cW2    = 300;

      ctx.save();
      ctx.translate(CW/2, CH/2 - 16);
      ctx.textAlign='center'; ctx.textBaseline='middle';

      // Card shadow + body
      ctx.shadowColor='rgba(0,0,0,0.55)'; ctx.shadowBlur=40;
      ctx.fillStyle='#FFFDF4';
      ctx.beginPath(); ctx.roundRect(-cW2/2,-cH/2,cW2,cH,26); ctx.fill();
      ctx.shadowBlur=0;

      // Header
      const hGrad=ctx.createLinearGradient(-cW2/2,-cH/2,cW2/2,-cH/2);
      hGrad.addColorStop(0,'#FF6B35'); hGrad.addColorStop(1,'#ff9f43');
      ctx.fillStyle=hGrad;
      ctx.beginPath(); ctx.roundRect(-cW2/2,-cH/2,cW2,58,[26,26,0,0]); ctx.fill();

      // Stage emoji + distance in header
      ctx.font='44px Arial';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(STAGES[state.stage].emoji,-50,-cH/2+29);
      ctx.font='bold 28px "Courier New",monospace';
      ctx.fillStyle='#fff';
      ctx.textAlign='left';
      ctx.fillText(`${dist}m`, -8, -cH/2+29);

      // NEW BEST badge
      if(isNew){
        ctx.save();
        ctx.fillStyle='rgba(255,215,0,0.92)';
        ctx.beginPath(); ctx.roundRect(62,-cH/2+12,76,34,17); ctx.fill();
        ctx.font='bold 11px Arial';
        ctx.fillStyle='#7a4e00';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('NEW BEST!', 100,-cH/2+29);
        ctx.restore();
      }

      // Divider
      ctx.strokeStyle='rgba(0,0,0,0.07)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(-cW2/2+20,-cH/2+58); ctx.lineTo(cW2/2-20,-cH/2+58); ctx.stroke();

      // Collectible rows
      let ry = -cH/2 + 106;
      const row = (emoji, count, col) => {
        ctx.font='44px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(emoji, -52, ry);
        ctx.font='bold 28px "Courier New",monospace';
        ctx.fillStyle=col; ctx.textAlign='left';
        ctx.fillText(`×${count}`, -12, ry);
        ry += 58;
      };
      row('🌱', state.plantCount, '#27ae60');
      row('🌽', state.cornCount,  '#e67e22');
      if(hasTri) row('🍀', state.trifoilCount, '#16a085');

      // Divider above total
      ry += 6;
      ctx.strokeStyle='rgba(0,0,0,0.09)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(-cW2/2+20, ry-18); ctx.lineTo(cW2/2-20, ry-18); ctx.stroke();

      // Total score row
      ctx.font='32px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🏆', -52, ry+10);
      ctx.font='bold 34px "Courier New",monospace';
      ctx.fillStyle='#c0392b';
      ctx.textAlign='left';
      ctx.fillText(`${total}`, -12, ry+10);

      ctx.restore();

      // Bouncing egg only (no finger)
      ctx.save();
      ctx.translate(CW/2, CH/2 + cH/2 + 36);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      const bounce = Math.abs(Math.sin(f*0.09))*9;
      ctx.font='52px Arial';
      ctx.fillText('🥚', 0, -bounce);
      ctx.restore();
    };

    // ── MASTER DRAW ────────────────────────────────────────────────────────────
    const draw = () => {
      ctx.save();
      if(mode==='title') drawTitle();
      else if(mode==='dead') drawDead();
      else drawGame();
      ctx.restore();
    };

    const loop = () => { update(); draw(); raf=requestAnimationFrame(loop); };
    loop();

    return ()=>{
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousedown',  onMouse);
      canvas.removeEventListener('touchstart', onMouse);
      window.removeEventListener('keydown',    onKey);
    };
  },[]);

  return (
    <div style={{
      width:'100vw', height:'100vh', background:'#050309',
      display:'flex', alignItems:'center', justifyContent:'center',
      userSelect:'none', touchAction:'none', overflow:'hidden',
    }}>
      <div style={{
        position:'relative',
        boxShadow:'0 0 80px rgba(255,160,30,0.25), 0 30px 60px rgba(0,0,0,0.8)',
        borderRadius:28,
        overflow:'hidden',
        border:'2px solid rgba(255,160,30,0.3)',
      }}>
        <canvas
          ref={canvasRef}
          style={{ display:'block', cursor:'pointer' }}
        />
      </div>
    </div>
  );
}
