// A small software 3D renderer: lit polygon faces, perspective, no WebGL dependency.
const phi = (1 + Math.sqrt(5)) / 2;
const normalize = v => { const n = Math.hypot(...v); return v.map(x => x / n); };
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const sub = (a,b) => a.map((x,i) => x-b[i]);
const dot = (a,b) => a.reduce((s,x,i) => s+x*b[i],0);
const meshes = new Map();
function mesh(sides) {
    if (meshes.has(sides)) return meshes.get(sides);
    let vertices;
    if (sides === 4) vertices = [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
    else if (sides === 6) vertices = [-1,1].flatMap(x => [-1,1].flatMap(y => [-1,1].map(z => [x,y,z])));
    else if (sides === 8) vertices = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    else if (sides === 10) vertices = [[0,1.25,0],[0,-1.25,0],...Array.from({length:5},(_,i)=>[Math.cos(i*Math.PI*2/5),0,Math.sin(i*Math.PI*2/5)])];
    else if (sides === 12) { const ico=mesh(20); vertices=ico.faces.map(face=>face.reduce((sum,i)=>sum.map((v,a)=>v+ico.vertices[i][a]/face.length),[0,0,0])); }
    else vertices = [-1,1].flatMap(a => [-1,1].flatMap(b => [[0,a,b*phi],[a,b*phi,0],[b*phi,0,a]]));
    vertices = vertices.map(normalize);
    const faces = [], seen = new Set();
    for (let i=0;i<vertices.length;i++) for(let j=i+1;j<vertices.length;j++) for(let k=j+1;k<vertices.length;k++) {
        let n = cross(sub(vertices[j],vertices[i]),sub(vertices[k],vertices[i]));
        if (Math.hypot(...n)<1e-6) continue;
        n=normalize(n);
        const distances=vertices.map(v=>dot(n,sub(v,vertices[i])));
        if (distances.some(d=>d>1e-5) && distances.some(d=>d< -1e-5)) continue;
        const indices=distances.flatMap((d,index)=>Math.abs(d)<1e-5?[index]:[]);
        const key=indices.join(','); if(seen.has(key)) continue; seen.add(key);
        const center=indices.reduce((s,index)=>s.map((v,a)=>v+vertices[index][a]/indices.length),[0,0,0]);
        if(dot(n,center)<0) n=n.map(x=>-x);
        const u=normalize(sub(vertices[indices[0]],center)), v=cross(n,u);
        indices.sort((a,b)=>Math.atan2(dot(sub(vertices[a],center),v),dot(sub(vertices[a],center),u))-Math.atan2(dot(sub(vertices[b],center),v),dot(sub(vertices[b],center),u)));
        faces.push(indices);
    }
    const result={vertices,faces}; meshes.set(sides,result); return result;
}
export function renderDiceMesh(die, sides, duration = 1100) {
    die._stopMesh?.();
    let canvas=die.querySelector('canvas');
    if(!canvas){canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');die.prepend(canvas);}
    const ctx=canvas.getContext('2d'); if(!ctx) return;
    const dpr=Math.min(window.devicePixelRatio||1,2); canvas.width=canvas.height=100*dpr;
    const geometry=mesh(sides); let raf=0, stopped=false;
    die._stopMesh=()=>{stopped=true;cancelAnimationFrame(raf);};
    const start=performance.now();
    function draw(now){
        if(stopped || !die.isConnected) return;
        const progress=duration?Math.min(1,(now-start)/duration):1;
        // Fixed axis, monotonic turns, smoothly decelerating to a stable pose.
        const angle=(1-Math.pow(1-progress,3))*Math.PI*8;
        const cy=Math.cos(angle+.3),sy=Math.sin(angle+.3),cx=Math.cos(.32),sx=Math.sin(.32);
        const points=geometry.vertices.map(([x,y,z])=>{const rx=x*cy+z*sy,rz=z*cy-x*sy;return[rx,y*cx-rz*sx,y*sx+rz*cx];});
        ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,100,100);
        geometry.faces.map(indices=>({indices,z:indices.reduce((s,i)=>s+points[i][2]/indices.length,0)})).sort((a,b)=>a.z-b.z).forEach(({indices})=>{
            const [a,b,c]=indices.map(i=>points[i]);const normal=normalize(cross(sub(b,a),sub(c,a)));
            const light=Math.max(0,dot(normal,normalize([-.5,-.7,1])));
            ctx.beginPath(); indices.forEach((i,k)=>{const [x,y,z]=points[i], scale=36/(1-z*.16);ctx[k?'lineTo':'moveTo'](50+x*scale,48+y*scale);});ctx.closePath();
            ctx.fillStyle=`hsl(270 45% ${25+light*47}%)`;ctx.fill();ctx.strokeStyle='rgba(230,204,255,.42)';ctx.lineWidth=.7;ctx.stroke();
        });
        if(progress<1) raf=requestAnimationFrame(draw);
    }
    draw(start);
}
