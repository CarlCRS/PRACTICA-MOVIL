// CONSUMO DE AMBOS PLUGINS EN LA APP (Ionic React)
// Instalar:
//   Cordova:   npx ionic cordova plugin add ../cordova-plugin-echo && npx cap sync
//   Capacitor: npm i ../capacitor-echo-plugin && npx cap sync

// --- 1. CONSUMO CORDOVA (global window.Echo inyectado en nativo) ---
declare global {
  interface Window { Echo?: { echo(msg: string): Promise<string> } }
}

export async function consumirCordovaEcho(msg: string): Promise<string> {
  // En web no existe -> fallback para poder desarrollar con npm run dev
  if (!window.Echo) return `[web-fallback] ${msg}`;
  return window.Echo.echo(msg); // en Android/iOS va al Echo.java / Echo.m
}

// --- 2. CONSUMO CAPACITOR (import tipado, con fallback web automático) ---
// En proyecto real: import { Echo } from 'capacitor-echo-plugin';
// Aquí demo local sin instalar el paquete (misma API):
import { registerPlugin } from '@capacitor/core';
const Echo = registerPlugin<{ echo(o: { msg: string }): Promise<{ msg: string }> }>(
  'Echo',
  {
    web: () => import('./echo-web-fallback').then((m) => new m.EchoWebFallback()),
  }
);

export async function consumirCapacitorEcho(msg: string): Promise<string> {
  const r = await Echo.echo({ msg }); // web->EchoWeb, nativo->EchoPlugin.java/.swift
  return r.msg;
}

// --- 3. USO EN UN COMPONENTE ---
// import { consumirCordovaEcho, consumirCapacitorEcho } from '../lib/echo-consumo';
// const r1 = await consumirCordovaEcho('hola');
// const r2 = await consumirCapacitorEcho('hola');
