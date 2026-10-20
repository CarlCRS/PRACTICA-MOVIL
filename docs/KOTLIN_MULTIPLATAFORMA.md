# Kotlin Multiplatform: Qué es, cómo encaja en TU caso y qué practicar

> Documento de referencia. Documentos hermanos:
> - `APRENDIZAJE_PLUGINS_KOTLIN.md` (plan con semanas y casos)
> - `PLUGINS_Y_CORRUTINAS.md` (plugins híbridos + corrutinas)
>
> Estado verificado a octubre 2026 con la doc oficial de Kotlin: KMP es **Stable para
> Android e iOS** (Beta para watchOS/tvOS y Wasm). No es experimental.

---

## 1. Qué es Kotlin Multiplatform (KMP) — 3 frases

1. **Un compilador**: toma código Kotlin "común" y lo compila a **binario nativo de cada
   plataforma** — bytecode JVM (Android), binario nativo iOS (framework/XCFramework),
   web (Wasm), desktop (JVM).
2. **Un proyecto Gradle** con "source sets": carpetas donde escribes lo común (`commonMain`)
   y lo específico por plataforma (`androidMain`, `iosMain`).
3. **Complemento, no reemplazo**: NO sustituye los plugins híbridos de Capacitor ni el
   SwiftUI/iOS nativo; reutiliza la capa de **lógica** (reglas, red, modelos) que hoy
   escribes DOS veces.

### La idea en un dibujo

```
                    ┌────────────── commonMain (Kotlin común) ─────────────┐
                    │  modelos, validaciones, llamadas HTTP, reglas   │
                    │  corrutinas (suspend fun)                            │
                    └──────────── ┬──────────────────┬─────────────── ┬──┘
                              kotlin compilador
                    ┌──────────────────┬──────────────────┐
                    ▼                  ▼                  ▼
               androidMain        iosMain         jvmCommonMain
             (Kotlin Android)   (Natik iOS)      (Desktop/Server)
                    │                  │
             .aar / classpath    .xcframework      (JAR)
                    │                  │
          app Android (tu plugin   app iOS (Swift importando
          Capacitor lo consume)    ese framework)
```

**Para tu matriz:** la integración típica es la que describe tu requisito iOS —
*"Swift con xframeworks y CocoaPods"*. En KMP, ese `.xcframework` es exactamente
lo que produce el compilador de Kotlin: **el mismo código común que corre en tu
plugin Android (Kotlin) puede compilar a un framework que el Swift consuma.**

---

## 2. KMP en TU ESTRUCTURA (FacePhi / INGIF-1442): el caso concreto

Tu matriz pide "integraciones nativas Swift y Kotlin" y "reescritura del lado nativo".
Hoy escribirías DOS veces la capa de SDK:

```
                        HOY (2 implementaciones)
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│ Android plugin (Kotlin)         │         │ iOS plugin (Swift)              │
│ suspend fun startScan()         │         │ func startScan() async          │
│ FacePhiSdk.startScan(...)      │         │ FacePhiSDK.startScan(...)       │
│ corrutinas ─ suspendCancellable │         │ async/await + continuations     │
└─────────────────────────────────┘         └─────────────────────────────────┘
              ❌ lógica y validaciones DUPLICADAS

                    CON KMP (SCI-E: 1 sola vez para la lógica)
┌────────────────────────────────────────────────────────────────────┐
│  commonMain (Kotlin común — UNA VEZ)                              │
│   - modelos: SolicitudScan, ResultadoScan, TemplateRostro          │
│   - validación de datos (reglas, cifrado simétrico liviano)       │
│   - corrutinas: async en common, Dispatchers en acceso nativo     │
│   - llamada HTTP de enrollment/login en .NET (Ktor)               │
└─────────────┬─────────────────────────────────┬────────────────────┘
              ▼                                 ▼
      androidMain: bridges a              iosMain: bridges a
      FacePhiSdk (Kotlin, suspend)        FacePhiSDK iOS (suspend)
              │                                 │
     capacitor-plan/f questo plugin        Swift plugin iOS
     (@PluginMethod lo consume TS)         (@objc plugins / KMP framework)
```

**Regla de división que funciona:**
- **KMP comparte:** modelos, validación, reglas de negocio, HTTP (Ktor DTO), cifrado
  simple, BD local (SQLDelight), tolerancia temporal, formateo de fechas/tokens.
- **NO comparte (queda en cada plataforma):** cámara/vista previa, biometría (FaceID /
  Keystore), protector de pantalla, Keychain/Encrypted SharedPreferences, el puente
  Capacitor (@PluginMethod / @objc).

> OJO — no confundas: el plugin híbrido de Capacitor sigue existiendo tal cual.
> KMP solo se mete DENTRO del lado nativo como librería compartida.
> El plugin Android llama al Kotlin común y el Swift iOS llama al mismo Kotlin
> compilado. El contrato TS no cambia.

---

## 3. Estructura de un proyecto KMP (lo que vas a crear)

```
mi-shared-kit/
├─ build.gradle.kts                      ← plugins kotlin("multiplatform") + Android
├─ settings.gradle.kts
├─ gradle/libs.versions.toml             ← versiones centralizadas (Kotlin, Ktor, SQLDelight)
└─ src/
   ├─ commonMain/kotlin/                 ← 80% del código: SIEMPRE compila para todos
   │  └─ com.ingif.planmedico/
   │     ├─ modelo/PlanMedico.kt         (data class, validación)
   │     ├─ red/PlansApi.kt              (interface — HTTP via Ktor)
   │     └─ dominio/GenerarPlan.kt       (corrutinas, reglas)
   ├─ androidMain/kotlin/
   │  └─ .../PlansApiAndroid.kt          (actual: impl. Android de la API)
   └─ iosMain/kotlin/
      └─ .../PlansApiIos.kt              (actual: impl. iOS de la API)
```

**Concepto `expect/actual`** (la herramienta clave del multiplataforma):
```kotlin
// commonMain
expect fun obtenerAlmacenamientoSeguro(): String

// androidMain
actual fun obtenerAlmacenamientoSeguro(): String = "EncryptedSharedPreferences"

// iosMain
actual fun obtenerAlmacenamientoSeguro(): String = "Keychain"
```

---

## 4. Cómo ENCAJA con lo que YA estás aprendiendo (corrutinas)

Las corrutinas son la LENGUA COMÚN del KMP moderno (en lugar de callbacks):
- `suspend fun` vive en `commonMain` → compila para Android y iOS.
- `kotlinx-coroutines-core` es multiplataforma: misma API en ambos lados.
- `Dispatchers.Main` tiene un `actual` implícito por plataforma (UI de Android/iOS).
- El patrón `suspendCancellableCoroutine` que ya practicaste funciona IDÉNTICO en common.

**Equivalencia directa con tu matriz:**
| Matriz lo pide... | KMP lo resuelve... |
|---|---|
| "Kotlin con corrutinas (suspend fun)" | corrutinas escriben COMMON — 1 vez |
| "Swift con xframeworks" | el build KMP produce el `.xcframework` |
| "CocoaPods" | plugin gradle `kotlin("native.cocoapods")` o SPM/XCFramework |
| "Android 15/16 + edge-to-edge" | el plugin Android sigue siendo quien consume el proxy|
| "Plugins híbridos·rescritura" | el plugin sigue siendo tu puente hacia el WS/WebView |

---

## 5. Qué INSTALAR y crear el primer proyecto (pasos reales)

### 5.1 Requisitos de entorno
1. **IDE:** Android Studio **Otter 2025.2.1+** o IntelliJ IDEA **2025.2.2+**.
2. **Plugin:** "Kotlin Multiplatform IDE plugin" (instálalo en el IDE, viene todo).
3. **ANDROID_HOME** apuntando al SDK de Android.
4. Para iOS **necesitas macOS + Xcode** (el compilador Kotlin hace cross-compile a iOS
   solo desde macOS — sin Mac, solo compila Android/Server/Desktop/JVM; iOS queda
   pendiente hasta que tengas Mac o CI macOS en la nube).

### 5.2 Crear el proyecto (IDE)
`File → New → Project → Kotlin Multiplatform`
- Targets: marca Android + iOS (Server/Desktop/Web opcional).
- "Share UI": NO marcas Compose Multiplatform (paras una librería pura),
  así el proyecto queda **capa lógica compartida** (lo que quieres antes del UI).

### 5.3 Comandos Gradle que vas a usar en el día a día

```bash
# Ver todos los targets configurados y qué tareas produce cada uno
./gradlew :shared:tasks

# Compilar el módulo común + targets (Android iOS JVM)
./gradlew :shared:build

# Compilar solo la parte Android (lo que instala tu plugin Capacitor)
./gradlew :shared:assembleDebug

# Compilar el framework iOS (desarrollando en macOS)
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64
```

> `XCFramework` = el binario universal que empaquetan las 4 arquitecturas iOS
> (device/simulator, Intel/Apple Silicon). Es lo que tu matriz llama "xframeworks"
> y lo que produce `"xcodebuild -create-xcframework"` un poco más abajo.

### 5.4 Cómo produce el framework iOS y cómo lo consume Swift

Con `kotlin("multiplatform")` en `build.gradle.kts` del módulo:

```kotlin
kotlin {
    androidTarget()            // compila .aar para Android
    iosX64(); iosArm64(); iosSimulatorArm64()

    // Produce el framework que Swift va a importar:
    listOf(
        iosX64(), iosArm64(), iosSimulatorArm64()
    ).forEach { target ->
        target.binaries.framework {
            baseName = "SharedKit"
            isStatic = true            // suele ser lo recomendado para apps iOS
        }
    }
}
```

Y Swift lo usa así:

```swift
import SharedKit

// Clase común que escribiste UNA vez en Kotlin
let api = PlansApi()  // generada por el compilador (protocolo brid sol)
Task {
    let plan = try await api.generarPlan(transcripcion: "...")  // suspend fun → async Swift
    print(plan.motivoConsulta)
}
```
> Las `suspend fun` de Kotlin llegan a Swift como **async Swift** — ese es el regalo
> de usar corrutinas.

---

## 6. Integración iOS: las 4 rutas (elige una)

| Ruta | Cuándo usarla | Nota |
|---|---|---|
| **Direct integration** | App iOS en el mismo mono-repo + gradle en la misma máquina | agrega un Run Script en Xcode (`embedAndSignAppleFrameworkForXcode`) |
| **CocoaPods (local podspec)** | tienes dependencias CocoaPods en el módulo Kotlin (`kotlin("native.cocoapods")`) | es la ruta que ya conoces por la matriz de FacePhi |
| **SwiftPM con XCFramework** | repos separados, distribución por SPM | compila `-create-xcframework` y lo duda |
| **Remote integration** (CocoaPods/SPM) | publicar a Maven/bintray y consumir por URL | para cuando son equipos distintos |

> Recomendación para tu caso: empieza con **direct integration** en desarrollo,
> pasa a **XCFramework via SPM** cuando quieras distribuir a otro equipo.

---

## 7. Qué NO es KMP (para no perder el foco)

1. **No reemplaza los plugins de Capacitor.** Tu app sigue siendo Ionic/React en
   WebView; el puente TS↔nativo sigue siendo el mismo `@PluginMethod`/`@objc`.
   KMP comparte la lógica DENTRO del nativo, no sustituye el puente.
2. **No es "un solo código de App para Android e iOS".** El UI en Android es
   Jetpack Compose, en iOS es SwiftUI: son nativos y separados. Solo con
   **Compose Multiplatform** compartirías también el UI (otra historia, otro
   aprendizaje).
3. **No es Java para iOS.** Kotlin/Native compila a binario iOS real (sin JVM).
4. **No es una bala mágica.** Expect/actual y disparidades de plataforma TLS,
   Keychain vs Keystore, APIs iOS no siguen el mismo modelo: aún necesitas
   chapter los puentes por plataforma.

---

## 8. Plan de práctica concreto impacto (semanas 8–12 de tu estudio)

### Semana 8 — Fundamento (cero iOS, SOLO Android + JVM)
- [ ] Crea el proyecto KMP con targets Android + JVM (Desktop) — sin iOS aún, para no bloquearte.
- [ ] Mueve la lógica de `plan-medico.ts` (si existe) a `commonMain/generarPlanMedico` en Kotlin y
      lea con JVM main + test unitario con `suspend fun`.
- [ ] Estudia que `kotlinx-coroutines-core`
      "same API en commonMain" (pasa tu demo `DemoCoroutines` en compila en common).

### Semana 9 — Android lo consume (capacitor)
- [ ] Incluye el módulo `shared/` como dependencia en `android/build.gradle` del
      plugin (o de la app) e integra un método del plugin que llame a
      `GenerarPlan.execute(...)` suspendido dentro de `scope.launch`.
- [ ] Publica/linkea un `.aar` del módulo y **verifica** que el plugin compiló
      con estándadr (`gradlew build`).

### Semana 10 — iOS (requerirá Mac/CI)
- [ ] Agrega targets iOS y genera el framework (`linkDebugFrameworkIos*`).
- [ ] Consume en un proyecto SwiftUI de prueba: `import SharedKit`,
      `Task { await api.generarPlan(...) }`, mapea las clases que llegan.
- [ ] **Ruta CocoaPods** (`kotlin("native.cocoapods")`) o **SPM/XCFramework** cuando
      quieras consumir desde Xcode sin Gradle.

### Semana 11 — Reglas de oro y review
- [ ] Correcta estructura de target: qué queremos en common vs androidMain/iosMain.
- [ ] Escenario `expect/actual` para indicar platform pre C/C (e.g., algo con Keychain).
- [ ] Public5000</think><tool_call>write<arg_key>content</arg_key><arg_value># Kotlin Multiplatform: Qué es, cómo encaja en TU caso y qué practicar

> Documento de referencia. Documentos hermanos:
> - `APRENDIZAJE_PLUGINS_KOTLIN.md` (plan de estudio con semanas y casos)
> - `PLUGINS_Y_CORRUTINAS.md` (plugins híbridos + corrutinas)
>
> Estado verificado (octubre 2026, doc oficial kotlinlang.org): KMP es **Stable para
> Android, iOS, Desktop y Server**; Beta para watchOS/tvOS y Wasm. No es experimental.

---

## 1. Qué es Kotlin Multiplatform (KMP) — en 3 frases

1. **Un compilador**: toma código Kotlin "común" y lo compila a **binario nativo de
   cada plataforma** — bytecode JVM (Android), binario nativo iOS (framework /
   XCFramework), Wasm (web), JVM (desktop/server).
2. **Un proyecto Gradle con "source sets"**: carpetas donde escribes lo común
   (`commonMain`) y lo específico por plataforma (`androidMain`, `iosMain`).
3. **Un complemento, no un reemplazo**: NO sustituye los plugins híbridos de
   Capacitor ni SwiftUI/iOS nativo; reutiliza la capa de **lógica** (reglas, red,
   modelos) que hoy escribirías DOS veces.

### La idea en un dibujo

```
              ┌───────── commonMain (Kotlin común, UNA vez) ──────────┐
              │  modelos, validaciones, reglas, HTTP (Ktor),          │
              │  corrutinas (suspend fun)                             │
              └───────────────────┬───────────────────────────────────┘
                             compilador Kotlin
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
    androidMain                iosMain                     jvmMain
   (Kotlin Android)          (Kotlin/Native)             (Desktop/Server)
        │                          │                          │
       .aar                  .xcframework                     .jar
        │                          │                          │
  app Android (tu plugin     app iOS (Swift importa       pruebas JVM /
  Capacitor lo consume)      ese framework)               lógica server
```

**Para tu matriz:** tu requisito iOS dice *"Swift con xframeworks y CocoaPods"* —
en KMP ese `.xcframework` es exactamente lo que produce el compilador de Kotlin:
**el mismo código común que corre en tu plugin Android (Kotlin) puede compilar a
un framework que el Swift consuma.**

---

## 2. KMP en TU ESTRUCTURA (FacePhi / INGIF-1442): el caso concreto

Tu matriz pide "integraciones nativas Swift y Kotlin" y "reescritura del lado nativo".
Hoy escribirías DOS veces la capa de SDK:

```
                      HOY (2 implementaciones separadas)
┌────────────────────────────────┐       ┌────────────────────────────────┐
│ Android plugin (Kotlin)        │       │ iOS plugin (Swift)             │
│ suspend fun startScan()        │       │ func startScan() async         │
│ FacePhiSdk.startScan(...)      │       │ FacePhiSDK.startScan(...)      │
│ corrutinas + suspendCancell.   │       │ async/await + continuations    │
└────────────────────────────────┘       └────────────────────────────────┘
              ❌ lógica y validaciones DUPLICADAS

                    CON KMP (1 sola vez para la lógica común)
┌─────────────────────────────────────────────────────────────────────┐
│  commonMain (Kotlin común — UNA VEZ)                               │
│   · modelos: SolicitudScan, ResultadoScan, TemplateRostro          │
│   · validación de datos (reglas, señales de alarma del plan)       │
│   · corrutinas: async en common, Dispatchers·bridging native       │
│   · HTTP de enrollement/login contra tu API .NET (Ktor)            │
└─────────────┬──────────────────────────────────┬────────────────────┘
              ▼                                  ▼
      androidMain: bridging a             iosMain: bridging a
      FacePhiSdk (Kotlin, suspend)        FacePhiSDK iOS (suspend)
              │                                  │
     tu plugin Capacitor Android          tu plugin iOS (Swift)
     (@PluginMethod lo consume TS)        (@objc / framework KMP)
```

**Regla de división que funciona:**
- **KMP comparte:** modelos, validación, reglas de negocio, HTTP (Ktor), DTOs con
  tu API .NET, cifrado simple, BD local (SQLDelight), formateo de fechas/tokens.
- **NO comparte (queda en cada plataforma):** cámara/vista previa, biometría
  (Face ID / Keystore), Keychain vs EncryptedSharedPreferences, el puente
  Capacitor (@PluginMethod / @objc).

> ⚠️ No confundas: el plugin híbrido de Capacitor sigue existiendo tal cual.
> KMP solo se mete DENTRO del lado nativo como librería compartida.
> El plugin Android llama al Kotlin común y el Swift iOS llama al mismo Kotlin
> compilado. **El contrato TS NO cambia.**

---

## 3. Estructura de un proyecto KMP (lo que vas a crear)

```
mi-shared-kit/
├─ build.gradle.kts                      ← plugins kotlin("multiplatform") + androidx
├─ settings.gradle.kts
├─ gradle/libs.versions.toml             ← versiones centralizadas (Kotlin, Ktor, ...)
└─ src/
   ├─ commonMain/kotlin/                 ← ~80% del código: SIEMPRE compila para todos
   │  └─ com/ingif/planmedico/
   │     ├─ modelo/PlanMedico.kt         (data class + validación)
   │     ├─ red/PlansApi.kt              (interface — HTTP vía Ktor)
   │     └─ dominio/GenerarPlan.kt       (corrutinas, reglas)
   ├─ androidMain/kotlin/
   │  └─ .../PlansApiAndroid.kt          (actual: impl. Android de la interface)
   └─ iosMain/kotlin/
      └─ .../PlansApiIos.kt              (actual: impl. iOS de la interface)
```

**Concepto `expect/actual`** (la herramienta clave del multiplataforma):
```kotlin
// commonMain — "espero que cada plataforma me dé esto"
expect fun almacenamientoSeguro(): String

// androidMain
actual fun almacenamientoSeguro(): String = "EncryptedSharedPreferences"

// iosMain
actual fun almacenamientoSeguro(): String = "Keychain"
```

---

## 4. Cómo ENCAJA con lo que YA estás aprendiendo (corrutinas)

Las corrutinas son la LENGUA COMÚN del KMP moderno (en lugar de callbacks):

- `suspend fun` vive en `commonMain` → compila para Android **y** iOS.
- `kotlinx-coroutines-core` es multiplataforma: misma API en ambos lados.
- `Dispatchers.Main` tiene un `actual` implícito por plataforma (UI de Android/iOS).
- El patrón `suspendCancellableCoroutine` que ya practicaste funciona idéntico en common.

| Tu matriz lo pide... | KMP lo resuelve... |
|---|---|
| "Kotlin con corrutinas (suspend fun)" | corrutinas escritas en common — 1 vez |
| "Swift con xframeworks" | el build KMP produce el `.xcframework` |
| "CocoaPods" | plugin gradle `kotlin("native.cocoapods")` o SPM/XCFramework |
| "Android 15/16 + edge-to-edge" | sigue siendo responsabilidad del plugin Android |
| "Plugins híbridos + reescritura" | el plugin sigue siendo tu puente con la WebView |

---

## 5. Qué instalar y crear el primer proyecto (pasos reales)

### 5.1 Requisitos de entorno (doc oficial, 2026)
1. **IDE:** Android Studio **Otter 2025.2.1+** o IntelliJ IDEA **2025.2.2+**.
2. **Plugin:** "Kotlin Multiplatform IDE plugin" (en el IDE; trae las dependencias).
3. **ANDROID_HOME** apuntando al SDK de Android.
4. Para iOS **necesitas macOS + Xcode** (el compilador hace cross-compile a iOS solo
   desde macOS — sin Mac, compila Android/JVM y dejas iOS para CI macOS en la nube).

### 5.2 Crear el proyecto (IDE)
`File → New → Project → Kotlin Multiplatform`
- Targets: Android + iOS (Server/Desktop/Web opcionales).
- "Share UI": desmarcado → proyecto de **librería** (capa lógica compartida,
  lo que quieres antes de tocar UI).

### 5.3 Comandos Gradle del día a día

```bash
# Ver los targets configurados y las tareas que produce cada uno
./gradlew :shared:tasks

# Compilar el módulo completo (todos los targets)
./gradlew :shared:build

# Compilar solo Android (lo que consume tu plugin Capacitor)
./gradlew :shared:assembleDebug

# Compilar el framework iOS (en macOS)
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64
```

### 5.4 Producir el framework iOS y consumirlo en Swift

En `build.gradle.kts` del módulo:

```kotlin
kotlin {
    androidTarget()                       // .aar para Android
    iosX64(); iosArm64(); iosSimulatorArm64()

    // Produce el framework que Swift importará:
    listOf(iosX64(), iosArm64(), iosSimulatorArm64()).forEach { target ->
        target.binaries.framework {
            baseName = "SharedKit"
            isStatic = true               // recomendado para apps iOS
        }
    }
}
```

Y en Swift:

```swift
import SharedKit

let api = PlansApi()
Task {
    // ¡Una suspend fun de Kotlin llega a Swift como async!
    let plan = try await api.generarPlan(transcripcion: "...")
    print(plan.motivoConsulta)
}
```
> Las `suspend fun` de Kotlin llegan a Swift como **async** — ese es el regalo
> de haber apostado por corrutinas.

### 5.5 Las 4 rutas de integración iOS

| Ruta | Cuándo usarla | Nota |
|---|---|---|
| **Direct integration** | App iOS y proyecto KMP en el mismo repo | agrega un Run Script en Xcode: `./gradlew :shared:embedAndSignAppleFrameworkForXcode` |
| **CocoaPods (local podspec)** | si el módulo KMP ya depende de pods (`kotlin("native.cocoapods")`) | es la ruta que pide tu matriz FacePhi |
| **SwiftPM con XCFramework** | repos separados; consumo por SPM | `xcodebuild -create-xcframework` y publicarlo |
| **Remote** (CocoaPods/SPM remoto) | publicar a Maven/SPM y consumir por URL | equipos distintos |

> Recomendación: empieza con **direct integration** en desarrollo; pasa a
> **XCFramework via SPM** cuando distribuyas a otro equipo o tengas repos separados.

---

## 6. Qué NO es KMP (para no perder el foco)

1. **No reemplaza los plugins de Capacitor.** Tu app sigue siendo Ionic/React en
   WebView; el puente TS↔nativo sigue siendo `@PluginMethod`/`@objc`.
   KMP comparte la lógica DENTRO del nativo, no sustituye el puente.
2. **No es "una app con un solo código para Android e iOS".** El UI Android es
   Jetpack Compose, el iOS es SwiftUI: nativos y separados. Solo con
   **Compose Multiplatform** compartirías también el UI (otro aprendizaje, otro dólar).
3. **No es Java para iOS.** Kotlin/Native compila binario iOS real, sin JVM.
4. **No elimina las diferencias de plataforma.** Keychain vs Keystore, permisos
   de cámara, TLS puntual, FaceID: el `expect/actual` programa los puentes.

---

## 7. Plan de práctica por semanas (Sep 8–12 de tu ruta de estudio)

### Semana 8 — Fundamento (SOLO Android + JVM, sin iOS para bloquearte)
- [ ] Crea el proyecto KMP con targets Android + JVM.
- [ ] Porta la regla de `generarPlanMedico` (de `plan-medico.ts`) a Kotlin común
      y prueba unitaria en `commonTest` con `runBlocking`.
- [ ] Comprueba que tu demo de corrutinas (`DemoCoroutines`) compila tal cual en
      `commonMain` (misma API de corrutinas).

### Semana 9 — Android lo consume (Capacitor)
- [ ] Incluye el módulo `shared/` como dependencia en `android/build.gradle` del
      plugin (proyecto local o publicado), y un `@PluginMethod` del plugin que
      llame a `GenerarPlan.ejecutar(...)` suspendido dentro de `scope.launch`.
- [ ] Verifica el build del plugin (`gradlew build`) con el `.aar` dentro.

### Semana 10 — iOS (requerirá Mac o CI macOS)
- [ ] Agrega targets iOS y genera el framework (`linkDebugFrameworkIos*`).
- [ ] Consume en un proyecto SwiftUI de prueba: `import SharedKit` + `Task { await ... }`.
- [ ] Elige CocoaPods o SPM/XCFramework para el consumo real.
- [ ] Pasa la regla de señales de alarma del plan (mismas alertas) y compárala
      con la que ya tienes en TS — verás que es 1 vs 2.

### Semana 11–12 — Reglas de oro + revisión
- [ ] Puedes decidir a ojo lo que entra a commonMain vs androidMain/iosMain.
- [ ] Añades un caso `expect/actual` concreto (Keychain/Keystore) y explica por qué.
- [ ] Explique a alguien de tu equipo: ¿qué gana este proyecto con KMP aparte?
      (regla práctica: si no hay PARTES tuneles que se escriben 2 veces,
       KMP puede no valer la pena a corto plazo — no es un religión).

---
---

## 8. Mini-evaluación final (sabes que dominas KMP si...)

Respondes estas 5 sin mirar:

1. ¿Qué produce el compilador KMP para Android y para iOS y en qué falta integrarlo?
   (`.aar` vs `.xcframework`; en Android vía Gradle dependencia, en iOS vía Direct/CocoaPods/SPM).
2. ¿Quién decide compilar contra Android vs iOS cuando el código difiere?
   (`expect/actual`, y TIENES que escribir cada `actual`).
3. ¿Qué se comparte y qué no en el caso FacePhi? (lógica/modelos/corutina = common;
   cámara/biometría/Keychain = plataforma; esto lo aclaró la sección 2).
4. ¿Por qué las suspend fun de Kotlin llegan "gratis" a Swift?
   (el compilador las expone como async Swift — es la razón para usar corrutinas).
5. ¿KMP reemplaza tu plugin Capacitor? (NO: el puente TS↔nativo sigue igual;
   KMP es una librería compartida DENTRO del lado nativo).

4 de 5 = ganada.

---

## 9. Glosario rápido

- **KMP**: tecnología de JetBrains (compilador + tooling Gradle) para
  compilar un módulo de Kotlin común a varias plataformas nativas.
- **Source set**: carpeta lógica por plataforma dentro del proyecto Gradle
  (`commonMain` común, `androidMain`, `iosMain`, `jvmMain`).
- **`expect/actual`**: la herramienta "la interface que programa" para que cada
  plataforma proporcione SU implementación de algo nativo.
- **XCFramework**: contenedor multi-arquitectura de Apple (device + simulator,
  Intel/Apple Silicon) — es el "xcframework" de tu matriz.
- **Kotlin/Native**: el backend del compilador que produce binarios puros (macos,
  iOS, Linux, Windows sin JVM).
- **Ktor**: framework HTTP multiplataforma (las llamadas a tu API C#/.NET que KMP
  comparte sin duplicar).
- **SQLDelight**: base de datos SQL multiplataforma (si el caching local vive).
- **Compose Multiplatform**: la extensión para COMPARTIR también el UI (otro
  aprendizaje; no lo necesitas para el caso de FacePhi).

---

## 10. Referencias oficiales (verificado a oct 2026)

- Introducción KMP e iOS myth-busting: https://kotlinlang.org/docs/multiplatform/kmp-for-ios.html
- Métodos de integración iOS (Direct / CocoaPods / SwiftPM): https://kotlinlang.org/docs/multiplatform/multiplatform-ios-integration-overview.html
- Quickstart de entorno (IDE + plugin + targets): https://kotlinlang.org/docs/multiplatform/multiplatform-setup.html
- Estabilidad de plataformas: https://kotlinlang.org/docs/multiplatform/supported-platforms.html
- Integración en app existente: https://kotlinlang.org/docs/multiplatform/multiplatform-integrate-in-existing-app.html
