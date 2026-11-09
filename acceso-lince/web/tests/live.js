"use strict";
const assert=require('node:assert/strict');
const {LiveScanGate}=require('../public/live-gate.js');
const g=new LiveScanGate(1100);
assert.equal(g.observe('LIN-1001',0),'LIN-1001');
assert.equal(g.observe('LIN-1001',500),null);
assert.equal(g.observe('LIN-1001',14000),null); // sostenido NO alterna entrada/salida
assert.equal(g.observe(null,14500),null);
assert.equal(g.observe('LIN-1001',14600),null);
assert.equal(g.observe(null,15500),null);
assert.equal(g.observe('LIN-1001',15501),null);
assert.equal(g.observe(null,16700),null);
assert.equal(g.observe('LIN-1001',16900),'LIN-1001');
assert.equal(g.observe('LIN-2001',16950),'LIN-2001');
g.reset();assert.equal(g.observe('LIN-1001',17000),'LIN-1001');
console.log('OK: 11 comprobaciones de escaneo continuo y rearme.');
