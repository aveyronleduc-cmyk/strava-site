// main.js — point d'entrée ESM pour BudgetZen
// Charge les modules, branche les événements, et initialise l'app.
import { state, load, save, fmt } from './state.js';
import { parseCSV, parseOFX, parseQIF, applyRules } from './parsers.js';
import { initTheme, bindGlobalActions, refreshAll } from './ui.js';

window.BudgetZen = { state }; // debug global minimal

async function init(){
  await load();
  // init sélecteurs
  const curSel = document.getElementById('currencySelect'); if(curSel) curSel.value = state.currency;
  if(state.encrypted){ const pwd = document.getElementById('passwordInput'); if(pwd) pwd.placeholder = '•••••••• (activé)'; }

  initTheme();
  bindGlobalActions();
  refreshAll();

  // Import fichiers
  const fileInput = document.getElementById('fileInput');
  if(fileInput){
    fileInput.addEventListener('change', async (e)=>{
      const file = e.target.files[0]; if(!file) return;
      const text = await file.text();
      let tx=[];
      if(file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv')) tx = parseCSV(text);
      else if(file.name.toLowerCase().endsWith('.ofx')) tx = parseOFX(text);
      else if(file.name.toLowerCase().endsWith('.qif')) tx = parseQIF(text);
      else tx = parseCSV(text);
      for(const t of tx){ applyRules(t); }
      state.transactions.push(...tx);
      await save(); refreshAll(); e.target.value = '';
    });
  }

  // Modèle CSV
  const templateBtn = document.getElementById('templateBtn'); if(templateBtn) templateBtn.onclick = ()=>{
    const csv = 'date,description,amount,category,account\n2025-08-01,SALAIRE,+2500,Salaire,Banque A\n2025-08-03,CARREFOUR,-82.35,Courses,Banque A\n2025-08-05,NETFLIX,-13.49,Abonnements,Carte X\n';
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {href:url, download:'budgetzen_modele.csv'});
    a.click(); URL.revokeObjectURL(url);
  };

  // Démo
  const demoBtn = document.getElementById('demoBtn'); if(demoBtn) demoBtn.onclick = async ()=>{
    const cats = ['Abonnements','Courses','Restaurants','Transport','Santé','Loisirs','Voyages','Salaire'];
    const merchants = { Abonnements:['NETFLIX','SPOTIFY','AMAZON PRIME'], Courses:['CARREFOUR','LIDL','AUCHAN'], Restaurants:["MCDONALD'S",'PIZZERIA ROMA','SUSHIYA'], Transport:['SNCF','UBER','TOTAL'], Santé:['PHARMACIE','DOCTOLIB'], Loisirs:['DECATHLON','FNAC'], Voyages:['AIR FRANCE','BOOKING'], Salaire:['SALAIRE'], };
    const now = new Date();
    for(let m=5;m>=0;m--){
      const base = new Date(now.getFullYear(), now.getMonth()-m, 5);
      state.transactions.push({id:crypto.randomUUID?.()||Math.random().toString(36), date: new Date(base.getFullYear(), base.getMonth(), 1).toISOString().slice(0,10), description:'SALAIRE', amount: 2500, category:'Salaire', account:'Démo', currency: state.currency});
      state.transactions.push({id:Math.random().toString(36), date: new Date(base.getFullYear(), base.getMonth(), 5).toISOString().slice(0,10), description:'NETFLIX', amount:-13.49, category:'Abonnements', account:'Démo', currency: state.currency});
      state.transactions.push({id:Math.random().toString(36), date: new Date(base.getFullYear(), base.getMonth(), 6).toISOString().slice(0,10), description:'SPOTIFY', amount:-9.99, category:'Abonnements', account:'Démo', currency: state.currency});
      for(let i=0;i<12;i++){
        const cat = cats[Math.floor(Math.random()*cats.length)]; if(cat==='Salaire') continue;
        const merch = merchants[cat][Math.floor(Math.random()*merchants[cat].length)];
        const day = 7 + Math.floor(Math.random()*21);
        const amt = - (5 + Math.random()*120);
        state.transactions.push({id:Math.random().toString(36), date: new Date(base.getFullYear(), base.getMonth(), day).toISOString().slice(0,10), description: merch, amount: parseFloat(amt.toFixed(2)), category:cat, account:'Démo', currency: state.currency});
      }
    }
    await save(); refreshAll();
  };
}

// go!
init();
