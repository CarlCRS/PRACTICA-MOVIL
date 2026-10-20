# Guía de referencia: Plugins híbridos + Kotlin Corrutinas

> Material consolidado para PRACTICA-MOVIL (Apoyo INGIF-1442 / FacePhi).
> Documentos hermanos: `APRENDIZAJE_PLUGINS_KOTLIN.md` (plan de estudio con semanas y casos).

---

## 1. Qué es un plugin HÍBRIDO (la aclaración que pide tu matriz)

**Un híbrido = UN paquete npm con MÚLTIPLES implementaciones del MISMO plugin:**

```
                capacitor-plan-seguro (1 paquete npm)
                ┌──────────────────────────────────┐
                │ contrato TS: guardar(), leer()   │  ← igual para todos
                ├──────────────────────────────────┤
                │ impl. web   (TypeScript/browser) │  ← navegador/PWA
                │ impl. Android (Kotlin)           │  ← APK
                │ impl. iOS (Swift)                │  ← IPA
                └──────────────────────────────────┘
                          el registerPlugin decide
```

Tu app escribe UNA sola llamada:

```ts
await PlanSeguro.guardar({ plan });
```

y esa misma línea funciona en navegador, APK de Android e IPA de iOS.

### El matiz (lo que distingue al desarrollador del consumidor)
- **Para quien CONSUME el plugin** — sí, funciona en "cualquier plataforma".
- **Para quien DESARROLLA el plugin** — escribes una implementación por plataforma:

| Plataforma | ¿Funciona sin código? | Qué escribes tú |
|---|---|---|
| Navegador | Solo con impl. web explícita | `src/web.ts` |
| Android | Solo con Kotlin | `PlanSeguroPlugin.kt` |
| iOS | Solo con Swift | `PlanSeguroPlugin.swift` |

Si falta una implementación, la llamada en esa plataforma **falla** ("método no implementado") — por eso se escribe siempre el fallback web para poder desarrollar con `npm run dev`.

### Dos palabras que NO confundir
1. **App híbrida** = tu app entera (tecnología web dentro de contenedor nativo: eso es Ionic/Capacitor). Nivel app.
2. **Plugin híbrido** = 1 plugin, varios cuerpos nativos. Nivel plugin. ← Esto es lo que pide la matriz.

**"Reescritura del lado nativo"** = entrar al Kotlin/Swift del plugin y modificarlo (nueva API del SDK, corrutinas, requisitos Android 15/16). Por eso el híbrido sirve: el nativo es tuyo, no caja negra como en Cordova.

---

## 2. El comando del generador

### Versión interactiva
En una terminal **fuera de tu app** (ej: `Documents\plugins\`):

```bash
npm init @capacitor/plugin@latest
```

El asistente pregunta: nombre (npm), package id (inversoDNS), class name, repo URL, descripción, y **lenguaje Android**.

### Versión un solo comando (no interactivo)

```bash
npm init @capacitor/plugin@latest plan-seguro -- ^
  --name capacitor-plan-seguro ^
  --package-id com.ingif.plugins.planse ^
  --class-name PlanSeguro ^
  --repo https://github.com/tu-usuario/tu-repo ^
  --author TuNombre ^
  --license MIT ^
  --description "Guarda el plan médico de forma segura" ^
  --android-lang kotlin
```

(`^` en Windows/cmd = continúa en la siguiente línea; en Git Bash usa `\`)

### Los 3 detalles que importan
1. **No es `npx cap plugin`** — `npx cap` gestiona tu app (sync/run/add); el generador de plugins es `npm init @capacitor/plugin@latest`.
2. **`--android-lang kotlin` es lo que necesitas** — el default es Java; sin el flag saldría Java.
3. **Dónde lo ejecutas** — en una carpeta Separada, no dentro de la app. Luego lo instalas:
   ```bash
   npm install ..\plugins\capacitor-plan-seguro
   npx cap sync
   ```

### Qué genera el comando (real)
```
capacitor-plan-seguro/
├─ src/
│  ├─ definitions.ts         ← contrato TS
│  ├─ index.ts               ← registerPlugin (dónde se decide web/nativo)
│  └─ web.ts                 ← impl. web
├─ android/                  ← LADO NATIVO 1 (Kotlin)
│  ├─ build.gradle, settings.gradle, gradle wrapper (compila sin AS)
│  ├─ AndroidManifest.xml
│  └─ src/main/kotlin/.../PlanSeguroPlugin.kt   ← @CapacitorPlugin + @PluginMethod
├─ ios/                      ← LADO NATIVO 2 (Swift)
│  ├─ Sources/PlanSeguroPlugin/PlanSeguroPlugin.swift
│  └─ Tests/...
├─ Package.swift             ← Swift Package Manager
├─ CapacitorPlanSeguro.podspec ← CocoaPods
├─ rollup.config.mjs         ← build del JS del paquete
└─ example-app/              ← appIonic linkeada de prueba
```

⚠️ El esqueleto oficial **no incluye corrutinas**: el puente viene listo, pero el patrón callbacks→suspend (FacePhi) lo agregas tú (dependencia `kotlinx-coroutines-android` + scope + `suspendCancellableCoroutine`).

---

## 3. Las piezas de todo plugin (los 5 archivos con rol)

| Pieza | Archivo | Rol |
|---|---|---|
| Contrato | `src/definitions.ts` | QUÉ se puede llamar (tipos). ES la frontera del plugin. |
| Web | `src/web.ts` | CÓMO en navegador (fallback). |
| Registro | `src/index.ts` | `registerPlugin('PlanSeguro', { web: ... })`. Decide web vs nativo. |
| Android | `android/.../PlanSeguroPlugin.kt` | CÓMO en Android (Kotlin). |
| iOS | `ios/Plugin/PlanSeguroPlugin.swift` | CÓMO en iOS (Swift). |
| Registro iOS | `ios/Plugin/PlanSeguroPlugin.m` | `CAP_PLUGIN(...)`: sin esto, "no such method". |
| CocoaPods | `CapacitorPlanSeguro.podspec` | sin esto, CocoaPods no instala iOS. |

Reglas del contrato:
- Métodos devuelven `Promise` (toda llamada cruza el puente async).
- Argumentos/retornos **serializables a JSON** (string/number/boolean/arrays/objetos planos). Nunca clases, funciones, Map.
- Si cambias la nativa pero mantienes el contrato, la app no se entera. Si cambias el CONTRATO, cambia la app.

---

## 4. El puente: qué pasa en UNA llamada (full picture)

```
1. UI: savings button "Guardar plan"
2. TS:  await PlanSeguro.guardar({plan})        ← Promise ABERTA
3. Bridge serializa {plan} → JSON
4. KOTLIN: @PluginMethod guardar(call)          ← entra en MAIN ⚠️
5. scope.launch {                              ← corrutina (IO)
6.    withContext(Dispatchers.IO) { prefs... }  ← trabajo pesado (contexto IO)
7.    call.resolve(JSObject())
8. TS:  await se resuelve → setState → UI
```

Reglas del puente:
- Solo travesa JSON serializable (y por eso los tipos del contrato).
- El nativo SIEMPRE termina con `call.resolve(...)` o `call.reject(...)`: si no, la Promise del TS se cuelga.
- Si el nativo explota sin tu try/catch, crashea; con `try/catch` + `call.reject`, la app solo ve la Promise rechazada.

---

## 5. Kotlin + Corrutinas aplicado A IONIC

### 5.1 Por qué EXISTEN aquí (el problema que resuelven)

Un `@PluginMethod` corre en el hilo **Main**. Si haces trabajo pesado ahí (disco, red, SDK),
la UI se congela y Android mata la app (ANR). Las corrutinas son la salida:

```
TS llama guardar() ──▶ Bridge ──▶ guardar(call) en MAIN  ← ⚠️ no hagas trabajo pesado
                                 └─▶ scope.launch { trabajo en IO }
```

### 5.2 Las 5 herramientas (solo necesitais estas)

| # | Herramienta | Qué hace |
|---|---|---|
| 1 | `CoroutineScope` | El "dueño de vida" de las corrutinas |
| 2 | `launch` | Arranca trabajo sin devolver resultado (Job) |
| 3 | `suspend fun` | Función que PAUSA sin bloquear el hilo |
| 4 | `withContext(Dispatchers.IO)` | Bloqueo de trabajo pesado en otro contexto |
| 5 | `suspendCancellableCoroutine` | Convierte callbacks en función pausable |

### 5.3 Las reglas de oro
1. Nunca trabajo pesado en Main → `withContext(Dispatchers.IO)`.
2. El scope manda: si Android destruye la Activity, `scope.cancel()` mata el subárbol sin fugas (*structured concurrency*).
3. Un `suspend fun` solo se llama desde otra corrutina/suspend fun.

### 5.4 Dispatchers
| Dispatcher | Uso |
|---|---|
| `Main` | UI (solo tocar estado visual) |
| `IO` | red, disco, DB, cámara |
| `Default` | CPU (cálculo, parseo grande) |

### 5.5 Equivalencias con TS (saque provecho de tu perfil base)

| Kotlin | Su alma gemela TS |
|---|---|
| `suspend fun` | `async function` |
| `scope.launch {}` | `void fn()` llamando sin `await` |
| `withContext(IO){}` | `await` con worker de fondo |
| `cont.resume(v)` | `resolve(v)` de una Promise |
| `cont.resumeWithException(e)` | `reject(e)` |
| `scope.cancel()` en `handleOnDestroy` | cleanup del `useEffect(() => () => ...)` |

### 5.6 El patrón CLAVE: callbacks → suspend (migración FacePhi)

API vieja (callbacks — cómo era la API de FacePhi hago nada):
```kotlin
SdkFalso.calcular(texto, max, object : SdkCallback {
    override fun onResultado(salida: String) { /* ... */ }
    override fun onError(e: Throwable) { /* ... */ }
})
```

El wrapper que "rescribe" (lo que haces TÚ):
```kotlin
private suspend fun resumenSuspend(texto: String, max: Int): String =
    suspendCancellableCoroutine { cont ->
        Sdk.calcular(texto, max, object : SdkCallback {
            override fun onResultado(salida: String) = cont.resume(salida)
            override fun onError(e: Throwable)      = cont.resumeWithException(e)
        })
        cont.invokeOnCancellation { /* SdkReal.cancel() */ }
    }
```

Y la nueva forma de llamar:
```kotlin
val salida = resumenSuspend(texto, max)  // suspend fun: línea a línea, sin callbacks
```

**El punto que debes entender de verdad:** en `resumenSuspend(...)` la corrutina se PAUSA y **el hilo se libera** (la UI sigue fluida). Cuando el SDK llama a `resume()`, la corrutina "reaparece" justo donde quedó. Eso es TODO el concepto de suspend: *pausar sin bloquear hilo*.

### 5.7 Dónde vive TODO en tu repo (referencia de código)

- Plugin híbrido completo: `plugins/capacitor-plan-seguro/`
  - Kotlin con corrutinas: `android/src/main/java/com/planseguro/plugin/PlanSeguroPlugin.kt`
  - Swift espejo: `ios/Plugin/PlanSeguroPlugin.swift`
- Consumidor en la app: `src/lib/plan-seguro.ts`
- Pantalla que lo usa: `src/pages/PlanMedico.tsx`

---

## 6. Arquitectura de la pantalla Plan Medico

```
Paciente habla ─▶ plugin capacitor-voice-recorder ─▶ audio base64
                ─▶ ElevenLabs Scribe ─▶ texto editable
                ─▶ plan-medico-ia.ts (LLM) o plan-medico.ts (reglas) ─▶ JSON plan
                ─▶ plan-seguro.ts (plugin propio) ─▶ histórico seguro
```

- Casco de fallback en todos los niveles:
  - Sin LLM key → reglas locales (offline).
  - Sin almacenamiento nativo → localStorage demo.
  - Sin plugin nativo → demo web.
- El plan SIEMPRE advierte: no es diagnóstico (advertencia en la UI + tests).

### Seguridad (lo que hay que iterar para producción)
- `VITE_*` keys terminan dentro del bundle del APK (fácil de extraer). En producción:
  ```
  App Ionic ── POST /api/plan ──▶ TU API C#/.NET ──▶ LLM
  ```
  La key vive solo en variables de entorno del backend.
- El secure storage real va por plugin nativo (Keystore Android / Keychain iOS).
- La llamada al LLM desde el cliente es para aprender el flujo SOLO.

---

## 7. Qué practicar (checklist de dominio)

### Plugins
- [ ] Explica los 5 archivos y su rol de memoria.
- [ ] Crea un método nuevo end-to-end: contrato TS → web.ts → Kotlin → `.m` → prueba.
- [ ] Instala el plugin en la app via `npm i ../plugins/capacitor-plan-seguro && npx cap sync`.
- [ ] Añade un @PluginMethod nuevo al Kotlin y llámalo desde la app.

### Corrutinas
- [ ] Nivel 0 — sintaxis: escribir launch/suspend/async-await en runBlocking.
- [ ] Nivel 1 — patrón de migración: escribir el mismo método con callbacks Y con suspend y comparar.
- [ ] Nivel 2 — puente: breakpoints en @PluginMethod, `launch` y `call.resolve` para ver los hilos.
- [ ] Nivel 3 — cancelación: `invokeOnCancellation` + cancelar al cerrar la pantalla.

### La mini-evaluación final
Puedes responder SIN mirar:
1. ¿En qué hilo entra un @PluginMethod y por qué necesitas launch/withContext?
2. ¿Qué pasa si el Kotlin nunca llama a call.resolve/reject? (Promise colgada).
3. ¿Dónde se pausa una corrutina y qué se libera? (El hilo, no el trabajo).
4. ¿El rol exacto de suspendCancellableCoroutine en la migración FacePhi?
5. ¿Por qué el scope vive en la clase del plugin y se cancela en handleOnDestroy?

4 de 5 = dominas la parte crítica de la matriz para Kotlin.

---

## 8. Glosario rápido

- **Plugin híbrido**: un paquete npm con implementación web + Kotlin + Swift del mismo contrato.
- **`registerPlugin`**: el punto que decide, en runtime, qué implementación se usa.
- **Contrato**: interfaz TS con tipos; la frontera entre app y nativo.
- **`@PluginMethod`** / **`@objc func`**: marca los métodos que el TS puede llamar (Android/iOS).
- **`PluginCall`**: objeto de UNA llamada del puente; `resolve`/`reject` cierran la Promise.
- **`suspendCancellableCoroutine`**: envuelve callbacks en suspend (patrón de migración).
- **Structured concurrency**: el ciclo de vida de corrutinas está acotado a su scope; si muere el scope, mueren las hijas.
- **Edge-to-edge / 16 KB page size**: requisitos de Google Play (API 35/36) que un plugin viejo puede no cumplir; por eso se reegcribe el nativo.
- **Keystore / Keychain**: almacenamiento seguro nativo Android/iOS. (Versión demo: SharedPreferences / UserDefaults).
