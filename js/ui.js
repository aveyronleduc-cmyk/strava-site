// ui.js — rendu du DOM et gestion des événements
import { state, fmt, DEFAULT_CATS, monthKey, escapeHtml, todayISO, uid, hasPassword, deriveKey, setPasswordKey, save, toCSV } from './state.js';
import { applyRules } from './parsers.js';
import { detectSubscriptions, computeTips } from './subscriptions.js';
import { currentMonth, monthIncome, monthExpenses, monthSpendByCategory } from './aggregations.js';

export function initTheme(){
  if(localStorage.getItem('budgetzen_theme')==='dark' || (matchMedia('(prefers-color-scheme: dark)').matches && !localStorage.getItem('budgetzen_theme'))){
    document.documentElement.classList.add('dark');
  }
  const btn = document.getElementById('darkToggle');
  if(btn) btn.onclick = ()=>{
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('budgetzen_theme', document.documentElement.classList.contains('dark')?'dark':'light');
  };
}

export function renderKPIs(){
  const m = currentMonth();
  const inc = monthIncome(m);
  const exp = monthExpenses(m);
  document.getElementById('kpiIn').textContent = fmt(inc);
  document.getElementById('kpiOut').textContent = fmt(exp);
  document.getElementById('kpiNet').textContent = fmt(inc - exp);
  document.getElementById('kpiSubs').textContent = detectSubscriptions().length;
}

export function renderMonthFilter(){
  const select = document.getElementById('monthFilter'); if(!select) return;
  const months = Array.from(new Set(state.transactions.map(t=>monthKey(t.date)))).sort();
  select.innerHTML = '<option value="">Tous mois</option>' + months.map(m=>`<option value="${m}">${m}</option>`).join('');
}

export function renderTxTable(){
  const tbody = document.getElementById('txTbody'); if(!tbody) return;
  const q = (document.getElementById('searchInput').value||'').toUpperCase().trim();
  const m = document.getElementById('monthFilter').value;
  const rows = state.transactions
    .slice().sort((a,b)=>b.date.localeCompare(a.date))
    .filter(t=>!m || monthKey(t.date)===m)
    .filter(t=> !q || (t.description||'').toUpperCase().includes(q) || (t.category||'').toUpperCase().includes(q) );
  tbody.innerHTML = rows.map(t=>`
    <tr class="border-t border-zinc-200 dark:border-zinc-800">
      <td class="whitespace-nowrap">${t.date}</td>
      <td>${escapeHtml(t.description||'')}</td>
      <td class="text-right ${t.amount<0?'text-red-600 dark:text-red-400':'text-emerald-600 dark:text-emerald-400'}">${fmt(t.amount)}</td>
      <td>${escapeHtml(t.category||'')}</td>
      <td>${escapeHtml(t.account||'')}</td>
      <td class="text-right whitespace-nowrap">
        <button class="tag hover:opacity-80" data-edit="${t.id}">éditer</button>
        <button class="tag hover:opacity-80" data-del="${t.id}">suppr.</button>
      </td>
    </tr>
  `).join('');
}

export function renderBudgets(){
  const wrap = document.getElementById('budgetsList'); if(!wrap) return;
  wrap.innerHTML = state.budgets.map(b=>{
    const spent = monthSpendByCategory(currentMonth(), b.category);
    const pct = b.amount>0? Math.min(100, Math.round((spent/b.amount)*100)) : 0;
    return `
    <div class="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <div class="flex items-center justify-between mb-2">
        <div class="font-medium">${escapeHtml(b.category)}</div>
        <div class="text-sm text-zinc-500">${fmt(spent)} / ${fmt(b.amount)}</div>
      </div>
      <div class="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div class="h-3 ${pct<80?'bg-emerald-500':pct<100?'bg-amber-500':'bg-red-600'}" style="width:${pct}%"></div>
      </div>
    </div>`;
  }).join('') || '<p class="text-sm text-zinc-500">Aucun budget. Ajoutez-en pour suivre vos plafonds mensuels.</p>';
}

export function renderRules(){
  const tbody = document.getElementById('rulesTbody'); if(!tbody) return;
  tbody.innerHTML = state.rules.map((r,i)=>`
    <tr class="border-t border-zinc-200 dark:border-zinc-800">
      <td>${escapeHtml(r.pattern)}</td>
      <td>${escapeHtml(r.category)}</td>
      <td class="text-right"><button class="tag hover:opacity-80" data-del-rule="${i}">suppr.</button></td>
    </tr>
  `).join('');
}

export function renderGoals(){
  const wrap = document.getElementById('goalsList'); if(!wrap) return;
  wrap.innerHTML = state.goals.map((g,i)=>{
    const saved = Math.max(0, (monthIncome(currentMonth()) - monthExpenses(currentMonth())) * 0.2 );
    const pct = g.target>0 ? Math.min(100, Math.round((saved/g.target)*100)) : 0;
    return `
      <div class="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div class="flex items-center justify-between mb-2">
          <div class="font-medium">${escapeHtml(g.name)}</div>
          <div class="text-sm text-zinc-500">Objectif: ${fmt(g.target)} • Échéance: ${g.due||'—'}</div>
        </div>
        <div class="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div class="h-3 ${pct<80?'bg-indigo-500':pct<100?'bg-amber-500':'bg-emerald-600'}" style="width:${pct}%"></div>
        </div>
        <div class="text-xs text-zinc-500 mt-1">Suggestion d\'épargne ce mois: ${fmt(saved)} (20% du solde net positif)</div>
        <div class="mt-2 text-right"><button class="tag" data-del-goal="${i}">suppr.</button></div>
      </div>
    `;
  }).join('') || '<p class="text-sm text-zinc-500">Aucun objectif défini.</p>';
}

export function renderSubs(){
  const tbody = document.getElementById('subsTbody'); if(!tbody) return;
  const subs = detectSubscriptions();
  tbody.innerHTML = subs.map((s,i)=>`
    <tr class="border-t border-zinc-200 dark:border-zinc-800">
      <td>${escapeHtml(s.merchant)}</td>
      <td class="text-right">${fmt(-Math.abs(s.avg))}</td>
      <td>${s.lastDate}</td>
      <td>${s.freq}</td>
      <td class="text-sm text-zinc-500">${escapeHtml(s.suggestions)}</td>
      <td class="text-right"><button class="tag" data-sub-opt="${s.merchant}">options</button></td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="text-sm text-zinc-500">Aucun abonnement récurrent détecté.</td></tr>';
}

export function renderTips(getters){
  const ul = document.getElementById('tipsList'); if(!ul) return;
  const tips = computeTips(getters);
  ul.innerHTML = tips.map(t=>`<li class="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800">${t}</li>`).join('') || '<li class="text-sm text-zinc-500">Importez des opérations pour obtenir des conseils personnalisés.</li>';
}

export function bindGlobalActions(){
  // table actions (event delegation)
  document.addEventListener('click', async (e)=>{
    const t = e.target;
    if(t.matches('[data-edit]')){ openTxDialog(t.getAttribute('data-edit')); }
    if(t.matches('[data-del]')){ const id=t.getAttribute('data-del'); state.transactions = state.transactions.filter(x=>x.id!==id); await save(); refreshAll(); }
    if(t.matches('[data-del-rule]')){ const i=+t.getAttribute('data-del-rule'); state.rules.splice(i,1); await save(); renderRules(); }
    if(t.matches('[data-del-goal]')){ const i=+t.getAttribute('data-del-goal'); state.goals.splice(i,1); await save(); renderGoals(); }
    if(t.matches('[data-sub-opt]')){ const m=t.getAttribute('data-sub-opt'); alert(`Pour « ${m} », pensez à :\n• vérifier l\'usage réel\n• passer à une formule annuelle\n• partager un abonnement familial\n• ou résilier si peu utilisé.`); }
  });

  const search = document.getElementById('searchInput'); if(search) search.oninput = renderTxTable;
  const month = document.getElementById('monthFilter'); if(month) month.onchange = renderTxTable;

  const addTx = document.getElementById('addTxBtn'); if(addTx) addTx.onclick = ()=>{
    const d = document.getElementById('txDialog');
    document.getElementById('txDate').value = todayISO();
    document.getElementById('txAmount').value = '';
    document.getElementById('txDesc').value = '';
    document.getElementById('txCat').value = '';
    document.getElementById('txAcc').value = '';
    d.showModal();
    document.getElementById('txSaveBtn').onclick = async (e)=>{
      e.preventDefault();
      const t = { id: uid(), date: document.getElementById('txDate').value, amount: parseFloat(document.getElementById('txAmount').value), description: document.getElementById('txDesc').value, category: document.getElementById('txCat').value, account: document.getElementById('txAcc').value, currency: state.currency };
      applyRules(t); state.transactions.push(t); await save(); refreshAll(); d.close();
    };
  };

  const addBudget = document.getElementById('addBudgetBtn'); if(addBudget) addBudget.onclick = ()=>{
    const d = document.getElementById('budgetDialog'); d.showModal();
    document.getElementById('budgetCat').value = '';
    document.getElementById('budgetAmount').value = '';
    document.getElementById('budgetSaveBtn').onclick = async (e)=>{
      e.preventDefault();
      const b = { category: document.getElementById('budgetCat').value, amount: parseFloat(document.getElementById('budgetAmount').value) };
      const idx = state.budgets.findIndex(x=>x.category===b.category);
      if(idx>=0) state.budgets[idx]=b; else state.budgets.push(b);
      await save(); renderBudgets(); d.close();
    };
  };

  const addRule = document.getElementById('addRuleBtn'); if(addRule) addRule.onclick = ()=>{
    const d = document.getElementById('ruleDialog'); d.showModal();
    document.getElementById('rulePattern').value='';
    document.getElementById('ruleCategory').value='';
    document.getElementById('ruleSaveBtn').onclick = async (e)=>{
      e.preventDefault();
      state.rules.push({ pattern: document.getElementById('rulePattern').value, category: document.getElementById('ruleCategory').value });
      await save(); renderRules(); d.close();
    };
  };

  const addGoal = document.getElementById('addGoalBtn'); if(addGoal) addGoal.onclick = ()=>{
    const d = document.getElementById('goalDialog'); d.showModal();
    document.getElementById('goalName').value='';
    document.getElementById('goalTarget').value='';
    document.getElementById('goalDue').value='';
    document.getElementById('goalSaveBtn').onclick = async (e)=>{
      e.preventDefault();
      state.goals.push({ name: document.getElementById('goalName').value, target: parseFloat(document.getElementById('goalTarget').value||'0'), due: document.getElementById('goalDue').value||'' });
      await save(); renderGoals(); d.close();
    };
  };

  const refreshSubs = document.getElementById('refreshSubsBtn'); if(refreshSubs) refreshSubs.onclick = ()=>{ renderSubs(); renderTips(getters); };

  const currency = document.getElementById('currencySelect'); if(currency) currency.onchange = async (e)=>{ state.currency = e.target.value; await save(); refreshAll(); };

  const setPwd = document.getElementById('setPasswordBtn'); if(setPwd) setPwd.onclick = async ()=>{
    const pass = document.getElementById('passwordInput').value;
    if(!pass){ setPasswordKey(null); state.encrypted=false; await save(); alert('Chiffrement désactivé.'); return; }
    const key = await deriveKey(pass); setPasswordKey(key); state.encrypted=true; await save(); alert('Chiffrement activé.');
  };

  const exportBtn = document.getElementById('exportBtn'); if(exportBtn) exportBtn.onclick = ()=>{
    const csv = toCSV(state.transactions);
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {href:url, download:'budgetzen_transactions.csv'});
    a.click(); URL.revokeObjectURL(url);
  };

  const exportJsonBtn = document.getElementById('exportJsonBtn'); if(exportJsonBtn) exportJsonBtn.onclick = async ()=>{
    // on exporte l'objet complet, potentiellement chiffré via encryptData dans state.js
    const payload = await import('./state.js').then(m=>m.encryptData(state));
    const blob = new Blob([JSON.stringify(payload)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {href:url, download:'budgetzen_data.json'});
    a.click(); URL.revokeObjectURL(url);
  };

  const importJsonBtn = document.getElementById('importJsonBtn'); if(importJsonBtn) importJsonBtn.onclick = ()=> document.getElementById('hiddenJsonImport').click();

  const hiddenImport = document.getElementById('hiddenJsonImport'); if(hiddenImport) hiddenImport.addEventListener('change', async (e)=>{
    const f=e.target.files[0]; if(!f) return; const text=await f.text();
    try{
      const obj=JSON.parse(text);
      if(obj && typeof obj==='object' && 'payload' in obj){
        const data = await import('./state.js').then(m=>m.decryptData(obj.payload));
        Object.assign(state, data);
      } else { Object.assign(state, obj); }
      await save(); refreshAll();
    }catch(err){ alert('Import JSON invalide'); }
  });

  const resetBtn = document.getElementById('resetBtn'); if(resetBtn) resetBtn.onclick = ()=>{ if(confirm('Supprimer toutes les données locales ?')){ localStorage.removeItem('budgetzen_v1'); location.reload(); } };

  const testProxyBtn = document.getElementById('testProxyBtn'); if(testProxyBtn) testProxyBtn.onclick = async ()=>{
    const url = document.getElementById('proxyUrlInput').value.trim(); if(!url){ alert('Renseignez l\'URL du proxy.'); return; }
    state.proxyUrl = url; await save();
    try{ await fetch(url, {method:'GET', mode:'no-cors'}); document.getElementById('proxyStatus').textContent='ok (non vérifié)'; }
    catch{ document.getElementById('proxyStatus').textContent='erreur'; }
  };
}

export function refreshAll(){
  renderKPIs();
  renderTxTable();
  renderMonthFilter();
  renderBudgets();
  renderRules();
  renderGoals();
  renderSubs();
  renderTips(getters);
  import('./aggregations.js').then(m=>m.renderChart());
  document.getElementById('catList').innerHTML = Array.from(new Set([...DEFAULT_CATS, ...state.budgets.map(b=>b.category), ...state.transactions.map(t=>t.category)])).filter(Boolean).sort().map(c=>`<option value="${c}"></option>`).join('');
}

export function openTxDialog(id){
  const t = state.transactions.find(x=>x.id===id); if(!t) return;
  const d = document.getElementById('txDialog');
  d.showModal();
  document.getElementById('txDate').value = t.date;
  document.getElementById('txAmount').value = t.amount;
  document.getElementById('txDesc').value = t.description;
  document.getElementById('txCat').value = t.category||'';
  document.getElementById('txAcc').value = t.account||'';
  document.getElementById('txSaveBtn').onclick = async (e)=>{
    e.preventDefault();
    Object.assign(t, { date: document.getElementById('txDate').value, amount: parseFloat(document.getElementById('txAmount').value), description: document.getElementById('txDesc').value, category: document.getElementById('txCat').value, account: document.getElementById('txAcc').value });
    await save(); refreshAll(); d.close();
  };
}

export const getters = { currentMonth, monthIncome, monthExpenses, monthSpendByCategory };
