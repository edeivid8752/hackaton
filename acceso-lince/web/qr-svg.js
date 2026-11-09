'use strict';
// QR Code Version 3, error correction L. Alphanumeric payload <= 77 characters.
// No external network calls or runtime dependencies. Output SVG safe for local printing.
const CHARS='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
function mul(a,b){let r=0;for(;b;b>>=1){if(b&1)r^=a;a<<=1;if(a&0x100)a^=0x11D;}return r;}
function qrSvg(text,px=320){
 text=String(text).toUpperCase();if(text.length>77||[...text].some(c=>!CHARS.includes(c)))throw Error('QR: contenido alfanumérico inválido');
 const bits=[];function append(v,n){for(let i=n-1;i>=0;i--)bits.push((v>>>i)&1);}
 append(2,4);append(text.length,9);
 for(let i=0;i+1<text.length;i+=2)append(CHARS.indexOf(text[i])*45+CHARS.indexOf(text[i+1]),11);
 if(text.length%2)append(CHARS.indexOf(text.at(-1)),6);
 const capacity=55*8;for(let n=Math.min(4,capacity-bits.length);n>0;n--)bits.push(0);
 while(bits.length%8)bits.push(0);
 const data=[];for(let i=0;i<bits.length;i+=8)data.push(parseInt(bits.slice(i,i+8).join(''),2));
 for(let i=0;data.length<55;i++)data.push(i%2?0x11:0xEC);
 const divisor=[1];for(let i=0;i<15;i++){
  const root=(()=>{let p=1;for(let j=0;j<i;j++)p=mul(p,2);return p;})();
  const next=new Array(divisor.length+1).fill(0);divisor.forEach((v,j)=>{next[j]^=v;next[j+1]^=mul(v,root);});divisor.splice(0,divisor.length,...next);
 }
 const rem=new Array(15).fill(0);for(const b of data){const factor=b^rem.shift();rem.push(0);for(let j=0;j<15;j++)rem[j]^=mul(divisor[j+1],factor);}
 const code=data.concat(rem), n=29, grid=Array.from({length:n},()=>Array(n).fill(false)), fixed=Array.from({length:n},()=>Array(n).fill(false));
 function put(x,y,value=true){if(x>=0&&y>=0&&x<n&&y<n){grid[y][x]=!!value;fixed[y][x]=true;}}
 function finder(cx,cy){for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const dist=Math.max(Math.abs(dx),Math.abs(dy));put(cx+dx,cy+dy,dist!==2&&dist!==4);}}
 finder(3,3);finder(n-4,3);finder(3,n-4);
 for(let i=8;i<n-8;i++){put(i,6,i%2===0);put(6,i,i%2===0);}
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)put(n-7+dx,n-7+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
 // Reserve format information cells; these are filled after the data bits.
 for(let i=0;i<=8;i++){if(i!==6){put(8,i,false);put(i,8,false);}}
 for(let i=0;i<8;i++){put(n-1-i,8,false);put(8,n-1-i,false);}
 put(8,n-8,true);
 let k=0;const allBits=code.flatMap(byte=>Array.from({length:8},(_,i)=>(byte>>>(7-i))&1));
 for(let right=n-1;right>=1;right-=2){if(right===6)right=5;let upwards=((right+1)&2)===0;
  for(let vert=0;vert<n;vert++)for(let j=0;j<2;j++){
   const x=right-j,y=upwards?n-1-vert:vert;if(fixed[y][x])continue;
   const raw=k<allBits.length?allBits[k++]:0;grid[y][x]=!!(raw^((x+y)%2===0?1:0));
  }
 }
 if(k!==70*8)throw Error('QR: cantidad de bits inesperada '+k);
 // Format data: L (01), mask 0. BCH(15,5) with XOR 0x5412.
 const value=8;let v=value;for(let i=0;i<10;i++)v=(v<<1)^(((v>>>9)&1)?0x537:0);
 const fmt=((value<<10)|v)^0x5412;
 const bit=i=>((fmt>>>i)&1)!==0;
 for(let i=0;i<=5;i++)put(8,i,bit(i));put(8,7,bit(6));put(8,8,bit(7));put(7,8,bit(8));
 for(let i=9;i<15;i++)put(14-i,8,bit(i));
 for(let i=0;i<8;i++)put(n-1-i,8,bit(i));for(let i=8;i<15;i++)put(8,n-15+i,bit(i));put(8,n-8,true);
 const rects=[];for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(grid[y][x])rects.push(`M${x+4} ${y+4}h1v1h-1z`);
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37 37" width="${Math.max(160,Math.min(1200,Number(px)||320))}" height="${Math.max(160,Math.min(1200,Number(px)||320))}" shape-rendering="crispEdges"><rect width="37" height="37" fill="white"/><path d="${rects.join('')}" fill="black"/></svg>`;
}
module.exports={qrSvg};
