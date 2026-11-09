/* Comportamiento compartible: un QR sostenido NO debe provocar otra entrada/salida. */
class LiveScanGate {
 constructor(absentMs=1100){this.absentMs=absentMs;this.held=null;this.lastSeen=0;}
 observe(code,now=Date.now()) {
  if(!code){if(this.held!==null && now-this.lastSeen>=this.absentMs)this.held=null;return null;}
  code=String(code).trim().toUpperCase();if(!code)return null;
  if(this.held===code){this.lastSeen=now;return null;}
  this.held=code;this.lastSeen=now;return code;
 }
 reset(){this.held=null;this.lastSeen=0;}
}
if(typeof module!=='undefined'&&module.exports)module.exports={LiveScanGate};
