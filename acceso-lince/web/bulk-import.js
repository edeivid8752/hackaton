'use strict';
const zlib=require('node:zlib');
function readZip(buf,limit=8*1024*1024){
 if(!Buffer.isBuffer(buf)||buf.length>6*1024*1024)throw Error('El ZIP de Excel es demasiado grande.');
 let end=-1;for(let i=buf.length-22;i>=Math.max(0,buf.length-65558);i--)if(buf.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw Error('Formato Excel inválido (ZIP).');
 const count=buf.readUInt16LE(end+10),offset=buf.readUInt32LE(end+16),files=new Map();let pos=offset,total=0;
 if(count>200)throw Error('Archivo Excel con demasiados componentes.');
 for(let i=0;i<count;i++){
  if(buf.readUInt32LE(pos)!==0x02014b50)throw Error('Directorio Excel inválido.');
  const method=buf.readUInt16LE(pos+10),comp=buf.readUInt32LE(pos+20),uncomp=buf.readUInt32LE(pos+24),nlen=buf.readUInt16LE(pos+28),extra=buf.readUInt16LE(pos+30),comment=buf.readUInt16LE(pos+32),local=buf.readUInt32LE(pos+42);
  const name=buf.subarray(pos+46,pos+46+nlen).toString('utf8');pos+=46+nlen+extra+comment;
  if(!name.startsWith('xl/')||!(/\.xml$/.test(name)))continue;
  if(uncomp>limit||total+uncomp>limit)throw Error('Archivo Excel descomprimido demasiado grande.');
  if(buf.readUInt32LE(local)!==0x04034b50)throw Error('Archivo XLSX inválido.');
  const start=local+30+buf.readUInt16LE(local+26)+buf.readUInt16LE(local+28);
  const compressed=buf.subarray(start,start+comp);
  const data=method===8?zlib.inflateRawSync(compressed,{maxOutputLength:limit}):method===0?compressed:null;
  if(!data||data.length!==uncomp)throw Error('Compresión Excel no compatible.');
  total+=data.length;files.set(name,data.toString('utf8'));
 }
 return files;
}
const xmlDecode=s=>String(s).replace(/&#x([0-9a-f]+);|&#([0-9]+);|&(amp|lt|gt|quot|apos);/gi,(_,hx,dec,ent)=>hx?String.fromCodePoint(parseInt(hx,16)):dec?String.fromCodePoint(Number(dec)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[ent]));
function readXlsx(buf){
 const zip=readZip(buf),shared=[];
 const ss=zip.get('xl/sharedStrings.xml')||'';
 for(const match of ss.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g))shared.push([...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(x=>xmlDecode(x[1])).join(''));
 const sheet=zip.get('xl/worksheets/sheet1.xml');if(!sheet)throw Error('No se encontró la primera hoja del Excel.');
 const rows=[];
 for(const match of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
  const row=[];
  for(const cm of match[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
   const ref=/\br="([A-Z]+)[0-9]+"/.exec(cm[1]);if(!ref)continue;
   let ix=0;for(const c of ref[1])ix=ix*26+c.charCodeAt(0)-64;ix--;
   if(ix<0||ix>90)continue;
   const type=/\bt="([^"]+)"/.exec(cm[1])?.[1];
   let value=/<v>([\s\S]*?)<\/v>/.exec(cm[2])?.[1]||'';
   if(type==='s')value=shared[Number(value)]||'';
   else if(type==='inlineStr')value=[...cm[2].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>xmlDecode(m[1])).join('');
   row[ix]=xmlDecode(value);
  }
  if(row.some(x=>String(x||'').trim()))rows.push(row.map(x=>x??''));
  if(rows.length>1001)throw Error('Máximo 1000 estudiantes por importación.');
 }
 return rows;
}
function readCsv(text){
 text=String(text).replace(/^\uFEFF/,'');const first=text.split(/\r?\n/,1)[0];const sep=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
 const rows=[],row=[];let cell='',quote=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(quote){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quote=false;else cell+=c;}
  else if(c==='"')quote=true;else if(c===sep){row.push(cell);cell='';}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(x=>String(x).trim()))rows.push(row.splice(0));else row.length=0;}
  else cell+=c;
 }
 if(quote)throw Error('CSV con comillas sin cerrar.');row.push(cell);if(row.some(x=>String(x).trim()))rows.push(row);
 if(rows.length>1001)throw Error('Máximo 1000 estudiantes por importación.');return rows;
}
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function rowsToStudents(rows){
 if(rows.length<2)throw Error('El archivo debe incluir encabezados y al menos un estudiante.');
 const cols=rows[0].map(normalize);
 function col(...names){for(const n of names){const i=cols.indexOf(n);if(i>=0)return i;}return -1;}
 const ix={id:col('matricula','identificacion','numeroempleado','id'),name:col('nombrecompleto','nombreyapellidos','alumno'),first:col('nombre','nombres'),last:col('apellidopaterno','primerapellido','apellidos','apellido'),maternal:col('apellidomaterno','segundoapellido'),career:col('carrera','programa','programaeducativo'),group:col('grupo','grupoescolar')};
 if(ix.id<0||(ix.name<0&&ix.first<0))throw Error('Encabezados requeridos: matricula y nombre completo (o nombre).');
 const students=rows.slice(1).filter(r=>r.some(x=>String(x||'').trim())).map((r,i)=>{
  const get=k=>ix[k]<0?'':String(r[ix[k]]||'').trim();
  const name=ix.name>=0?get('name'):[get('first'),get('last'),get('maternal')].filter(Boolean).join(' ');
  return {line:i+2,institutional_id:get('id').replace(/\.0$/,''),name,career:get('career'),group_name:get('group'),first_surname:get('last')};
 });
 return students;
}
function parseBulk(filename,contents){
 if(typeof contents!=='string'||contents.length>8*1024*1024)throw Error('Archivo demasiado grande.');
 const buffer=Buffer.from(contents,'base64');
 if(buffer.length>5*1024*1024)throw Error('Archivo máximo: 5 MB.');
 const rows=/\.xlsx$/i.test(filename)?readXlsx(buffer):/\.csv$/i.test(filename)?readCsv(buffer.toString('utf8')):(()=>{throw Error('Solo archivos .xlsx o .csv.');})();
 return rowsToStudents(rows);
}
// ZIP writer with STORE method for streaming-compatible, offline exports.
let table;function crc32(buf){if(!table){table=Array.from({length:256},(_,k)=>{for(let i=0;i<8;i++)k=(k&1)?(k>>>1)^0xEDB88320:k>>>1;return k>>>0;});}let crc=0xFFFFFFFF;for(const b of buf)crc=table[(crc^b)&255]^(crc>>>8);return (crc^0xFFFFFFFF)>>>0;}
function zipFiles(items){let offset=0;const locals=[],central=[];
 for(const [name,content] of items){const file=Buffer.from(content),label=Buffer.from(name),crc=crc32(file);
  const a=Buffer.alloc(30);a.writeUInt32LE(0x04034B50,0);a.writeUInt16LE(20,4);a.writeUInt32LE(crc,14);a.writeUInt32LE(file.length,18);a.writeUInt32LE(file.length,22);a.writeUInt16LE(label.length,26);
  locals.push(a,label,file);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014B50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc,16);c.writeUInt32LE(file.length,20);c.writeUInt32LE(file.length,24);c.writeUInt16LE(label.length,28);c.writeUInt32LE(offset,42);central.push(c,label);offset+=a.length+label.length+file.length;
 }
 const end=Buffer.alloc(22),csz=central.reduce((n,b)=>n+b.length,0);end.writeUInt32LE(0x06054B50,0);end.writeUInt16LE(items.length,8);end.writeUInt16LE(items.length,10);end.writeUInt32LE(csz,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,...central,end]);
}
module.exports={parseBulk,readCsv,readXlsx,zipFiles};
