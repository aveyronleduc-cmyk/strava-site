// aggregations.js — calculs mensuels et rendu du graphique
import { state, monthKey, fmt } from './state.js';

export const currentMonth = ()=> new Date().toISOString().slice(0,7);
export function monthIncome(mKey){ return state.transactions.filter(t=>monthKey(t.date)===mKey && t.amount>0).reduce((s,t)=>s+t.amount,0); }
export function monthExpenses(mKey){ return Math.abs(state.transactions.filter(t=>monthKey(t.date)===mKey && t.amount<0).reduce((s,t)=>s+t.amount,0)); }
export function monthSpendByCategory(mKey, cat){ return Math.abs(state.transactions.filter(t=>monthKey(t.date)===mKey && t.amount<0 && (t.category||'')===cat).reduce((s,t)=>s+t.amount,0)); }

export function getLastNMonths(n){ const out=[]; const d=new Date(); for(let i=n-1;i>=0;i--){ const dt=new Date(d.getFullYear(), d.getMonth()-i, 1); out.push(dt.toISOString().slice(0,7)); } return out; }

let cashChart=null;
export function renderChart(){
  const ctx = document.getElementById('cashflowChart'); if(!ctx) return;
  const months = getLastNMonths(12);
  const income = months.map(m=>monthIncome(m));
  const expenses = months.map(m=>monthExpenses(m));
  const net = months.map((_,i)=>income[i]-expenses[i]);
  if(cashChart) cashChart.destroy();
  cashChart = new Chart(ctx, {
    type: 'line',
    data: { labels: months, datasets: [
      { label: 'Revenus', data: income, tension: .25 },
      { label: 'Dépenses', data: expenses, tension: .25 },
      { label: 'Net', data: net, tension: .25 }
    ] },
    options: { responsive: true, plugins: { legend:{position:'bottom'} }, scales:{ y:{ ticks:{ callback:(v)=>fmt(v) } } } }
  });
}
