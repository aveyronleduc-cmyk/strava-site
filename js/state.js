// state.js — gestion de l'état, persistance & chiffrement
export const APP_KEY = 'budgetzen_v1';
export const DEFAULT_CATS = ['Abonnements','Logement','Courses','Restaurants','Transport','Santé','Loisirs','Voyages','Cadeaux','Impôts','Épargne','Salaire','Autre'];

export const state = {
  currency: 'EUR',
  transactions: [],
  budgets: [],
  rules: [
    {pattern: 'NETFLIX', category: 'Abonnements'},
    {pattern: 'SPOTIFY', category: 'Abonnements'},
    {pattern: 'AMAZON PRIME', category: 'Abonnements'},
    {pattern: 'UBER', category: 'Transport'},
    {pattern: 'SNCF', category: 'Transport'},
    {pattern: 'CARREFOUR', category: 'Courses'},
  ],
  goals: [],
  proxyUrl: '',
  encrypted: false,
};

let passwordCache = null; // CryptoKey non persistée
export const setPasswordKey = (k)=>{ passwordCache = k; };
export const hasPassword = ()=> !!passwordCache;

// Utils
export const fmt = (n, cur = state.currency) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur }).format(n);
export const by = (k) => (a,b) => a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0;
export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
export const todayISO = () => new Date().toISOString().slice(0,10);
export const monthKey = (d) => new Date(d).toISOString().slice(0,7);
export const norm = (s) => (s||'').toString().toUpperCase().replace(/\s+/g,' ').trim();
export const escapeHtml = (s)=> (s||'').replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
export const escapeCsv = (s)=> '"'+String(s).replace(/"/g,'""')+'"';

// Crypto
export async function deriveKey(pass){
  const enc = new TextEncoder();
  const salt = enc.encode('budgetzen_salt_v1');
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:120000, hash:'SHA-256'}, keyMaterial, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
}

export async function encryptData(obj){
  if (!passwordCache) return {encrypted:false, payload: JSON.stringify(obj)};
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = await crypto.subtle.encrypt({name:'AES-GCM', iv}, passwordCache, data);
  return {encrypted:true, payload: btoa(String.fromCharCode(...iv)) + '.' + btoa(String.fromCharCode(...new Uint8Array(cipher)))};
}

export async function decryptData(payload){
  if (!payload) return null;
  try { return JSON.parse(payload); } catch {}
  if (!passwordCache) throw new Error('Mot de passe requis');
  const [ivB64, dataB64] = payload.split('.');
  const iv = Uint8Array.from(atob(ivB64), c=>c.charCodeAt(0));
  const data = Uint8Array.from(atob(dataB64), c=>c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv}, passwordCache, data);
  return JSON.parse(new TextDecoder().decode(plain));
}

// Persistence
export async function save(){
  const data = { ...state, encrypted: hasPassword() };
  const {encrypted, payload} = await encryptData(data);
  localStorage.setItem(APP_KEY, JSON.stringify({encrypted, payload}));
}
export async function load(){
  const raw = localStorage.getItem(APP_KEY);
  if (!raw) return;
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && 'payload' in obj) {
      const data = await decryptData(obj.payload);
      Object.assign(state, data);
      state.encrypted = obj.encrypted;
    } else {
      Object.assign(state, JSON.parse(raw));
    }
  } catch(e){ console.warn('Erreur de chargement', e); }
}

// Export helpers
export function toCSV(arr){
  const header = 'date,description,amount,category,account\n';
  const body = arr.map(t=>[t.date, escapeCsv(t.description), t.amount, escapeCsv(t.category||''), escapeCsv(t.account||'')].join(',')).join('\n');
  return header+body;
}
