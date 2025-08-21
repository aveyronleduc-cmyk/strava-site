// subscriptions.js — détection d'abonnements récurrents et conseils
import { state, norm, fmt } from './state.js';

export function detectSubscriptions(){
  const map = new Map();
  for(const t of state.transactions){
    if (t.amount >= 0) continue; // on ne regarde que les débits
    const key = norm(t.description).replace(/\d+/g,'').trim();
    if(!key) continue; const arr = map.get(key) || []; arr.push(t); map.set(key, arr);
  }
  const subs=[];
  map.forEach((arr, merchant)=>{
    arr.sort((a,b)=>a.date.localeCompare(b.date));
    if(arr.length < 2) return;
    let monthlyHits = 0; let last = null; let sumAbs = 0;
    for(const a of arr){
      sumAbs += Math.abs(a.amount);
      if(last){
        const d1 = new Date(last.date), d2 = new Date(a.date);
        const days = Math.round((d2-d1)/86400000);
        if(days>=27 && days<=33) monthlyHits++;
      }
      last = a;
    }
    if (monthlyHits >= 1) {
      const avg = sumAbs / arr.length;
      subs.push({ merchant, avg, lastDate: arr[arr.length-1].date, freq: 'Mensuel', suggestions: suggestForMerchant(merchant, avg) });
    }
  });
  return subs.sort((a,b)=>b.avg-a.avg);
}

export function suggestForMerchant(name, avg){
  const n = name.toUpperCase();
  if(n.includes('NETFLIX')||n.includes('SPOTIFY')||n.includes('DISNEY')) return 'Vérifiez l\'usage et envisagez un partage familial.';
  if(n.includes('ORANGE')||n.includes('SFR')||n.includes('FREE')) return 'Comparez les forfaits : souvent 5–10€ d\'économie/mois.';
  if(avg>20) return 'Négociez ou cherchez une alternative moins chère.';
  return 'OK si utile. Ré-évaluez tous les 3 mois.';
}

export function computeTips(getters){
  const tips=[];
  const subs = detectSubscriptions();
  const subTotal = subs.reduce((s,x)=>s+x.avg,0);
  if(subTotal>0) tips.push(`Vos abonnements pèsent ~ ${fmt(subTotal)} / mois. Supprimez-en 1 pour économiser immédiatement.`);
  for(const b of state.budgets){
    const spent = getters.monthSpendByCategory(getters.currentMonth(), b.category);
    if(b.amount>0 && spent > b.amount){
      tips.push(`Dépassement du budget « ${b.category} » de ${fmt(spent-b.amount)}. Geler la dépense sur 7 jours.`);
    }
  }
  const income = getters.monthIncome(getters.currentMonth());
  const expenses = getters.monthExpenses(getters.currentMonth());
  if(income>0){
    const saveRate = Math.max(0, (income - expenses)/income);
    tips.push(`Taux d\'épargne estimé: ${(saveRate*100).toFixed(0)}%. Objectif simple: +5 pts le mois prochain.`);
  }
  tips.push('Astuce: activez les Règles pour auto-classer vos opérations (gain de temps ✨).');
  if(state.goals.length===0) tips.push('Définissez un objectif d\'épargne pour rester motivé.');
  return tips;
}
