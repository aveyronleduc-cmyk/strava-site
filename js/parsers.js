// parsers.js — lecture CSV/OFX/QIF et auto-catégorisation
import { state, uid, monthKey } from './state.js';

export function parseDate(s){
  if(!s) return null; s = s.trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(dmy){ const [_,d,m,y]=dmy; const dt=new Date(+y, +m-1, +d); return dt.toISOString().slice(0,10); }
  const dt = new Date(s); if(!isNaN(dt)) return dt.toISOString().slice(0,10);
  return null;
}

export function parseCSV(text){
  const lines = text.replace(/\r/g,'').split('\n').filter(Boolean);
  if (lines.length === 0) return [];
  const sep = (lines[0].includes(';') && !lines[0].includes(',')) ? ';' : ',';
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase());
  const idx = {
    date: header.findIndex(h=>/date/.test(h)),
    desc: header.findIndex(h=>/desc|libell|label|name/.test(h)),
    amount: header.findIndex(h=>/amount|montant|value|valeur/.test(h)),
    category: header.findIndex(h=>/categ/.test(h)),
    account: header.findIndex(h=>/account|compte/.test(h)),
    currency: header.findIndex(h=>/curr|devise/.test(h)),
  };
  const out=[];
  for (let i=1;i<lines.length;i++){
    const cols = lines[i].split(sep).map(c=>c.replace(/^"|"$/g,'').trim());
    const d = parseDate(cols[idx.date]);
    const amt = parseFloat(cols[idx.amount]?.replace(',', '.'));
    if (!d || isNaN(amt)) continue;
    out.push({ id: uid(), date: d, description: cols[idx.desc] || '', amount: amt, category: cols[idx.category] || '', account: cols[idx.account] || '', currency: cols[idx.currency] || state.currency });
  }
  return out;
}

export function parseOFX(text){
  const tx=[]; const re = /<STMTTRN>[\s\S]*?<DTPOSTED>(.*?)\s*<TRNAMT>(.*?)\s*<NAME>(.*?)\s*<\/STMTTRN>/g;
  let m; while((m=re.exec(text))){
    const dt = m[1].slice(0,8); // YYYYMMDD
    const d = new Date(dt.slice(0,4)+'-'+dt.slice(4,6)+'-'+dt.slice(6,8)).toISOString().slice(0,10);
    tx.push({ id: uid(), date:d, description:m[3], amount: parseFloat(m[2]), category:'', account:'', currency: state.currency });
  }
  return tx;
}

export function parseQIF(text){
  const lines = text.split(/\r?\n/); const tx=[]; let cur={};
  for(const line of lines){
    const t=line.trim(); if(!t) continue;
    const tag = t[0]; const val=t.slice(1);
    if(tag==='D'){ const d=parseDate(val); cur.date=d; }
    else if(tag==='T'){ cur.amount=parseFloat(val.replace(',','.')); }
    else if(tag==='P'){ cur.description=val; }
    else if(tag==='^'){ if(cur.date && !isNaN(cur.amount)){ tx.push({id:uid(), date:cur.date, description:cur.description||'', amount:cur.amount, category:'', account:'', currency: state.currency}); } cur={}; }
  }
  return tx;
}

export function applyRules(tx){
  for(const r of state.rules){
    const isRegex = /^\/.+\/$/.test(r.pattern);
    const test = isRegex ? new RegExp(r.pattern.slice(1,-1),'i') : new RegExp(r.pattern.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');
    if(test.test(tx.description||'')) tx.category = r.category;
  }
}
