# capacitor-plan-seguro (plugin demo)

Plugin didáctico hecho para aprender **exáctamente** lo que pide tu matriz
(INGIF-1442): desarrollo de plugins híbridos Capacitor "no solo consumo",
con lado nativo **Android (Kotlin + corrutinas)** y **iOS (Swift)**.

## Qué demuestra

1. **Contrato TS único** (`src/definitions.ts`) — la "frontera" del plugin.
2. **Impl. web fallback** (`src/web.ts`) — la app corre en navegador sin nativo.
3. **Lado nativo Android** (`android/.../PlanSeguroPlugin.kt`) con:
   - `@PluginMethod` + `call.resolve/reject` (el puente).
   - **Corrutinas** (`scope.launch`, `Dispatchers.IO`, `SupervisorJob`).
   - **Patrón callbacks → suspend** con `suspendCancellableCoroutine`
     (exactamente la migración de la API FacePhi).
4. **Lado nativo iOS** (`ios/Plugin/PlanSeguroPlugin.swift` + registro `.m` + podspec).
5. **Requisitos Android 15/16**: `compileSdkVersion 36`, `useLegacyPackaging false`
   (16 KB page size).

## Los 4 archivos de cada pieza (memoriza los roles)

| Pieza | Archivo | Rol |
|---|---|---|
| Contrato | `src/definitions.ts` | QUÉ se puede llamar (tipos) |
| Web | `src/web.ts` | CÓMO en navegador (fallback) |
| Registro | `src/index.ts` | `registerPlugin('PlanSeguro', { web: ... })` |
| Android | `android/.../PlanSeguroPlugin.kt` | CÓMO en Android (Kotlin/corrutinas) |
| iOS | `ios/Plugin/PlanSeguroPlugin.swift` + `.m` + podspec | CÓMO en iOS |

## Instalarlo en la app

```bash
# desde la carpeta del plugin (construye el JS del paquete)
cd plugins/capacitor-plan-seguro
npm install
npm run build

# desde la raíz de la app
cd ../..
npm install ../plugins/capacitor-plan-seguro
npx cap sync
npx cap add android     # genera android/ con TU plugin داخل
npx cap run android     # prueba en emulador
```

## Consumirlo (ya lo tienes en `src/lib/plan-seguro.ts`)

```ts
import { PlanSeguro } from 'capacitor-plan-seguro';

// guardar
await PlanSeguro.guardar({ plan: { id: '1', fecha: new Date().toISOString(), motivo: 'X', planJson: '{}' } });

// leer
const { planes, seguro } = await PlanSeguro.leer({ max: 10 });

// demo del patrón callbacks→suspend
const { resumen } = await PlanSeguro.resumen({ texto: 'la transcripción del paciente', maxPalabras: 10 });
```

## Nota clave

`npx cap sync` **no** copia tu código nativo a la app: lo **linkea** como
dependencia. El código Kotlin/Swift sigue DENTRO de la carpeta del plugin —
eso es la "reescritura del lado nativo": editas aquí, ejecutas `cap sync` +
`cap run`, y el cambio llega al teléfono.

## Cómo probar que el puente funciona (sin instalar en la app)

Con la carpeta del plugin compilada (`npm run build`), la implementación web
ya responde en el navegador. En dispositivo solo hace falta `npx cap sync` +
`npx cap run android` para llegar al Kotlin real.
