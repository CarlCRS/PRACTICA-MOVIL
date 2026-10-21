# Integrar FacePlugin (SDK biométrico cerrado) en Ionic + Capacitor

Resumen de la integración hecha en `myapp`. Sirve como plantilla para cualquier
SDK nativo de este tipo (Regula, Innovatrics, IDKit, etc.).

## 1. Anatomía

```
React (Rostro.tsx)
   └─ face-recognition-capacitor  ← wrapper TS: contrato + registerPlugin
        └─ módulo Capacitor (Kotlin/Swift)  ← recibe llamadas del WebView
             └─ facerecognitionsdk.aar      ← binarios .so + modelos frc.fpk
```

El JS nunca procesa la imagen. Solo viajan **URIs** (`file://`, `content://`) y
**JSON** (cajas, landmarks, liveness, edad). Eso es una integración híbrida.

## 2. Instalación

```bash
# 1. bajar el runtime (455 MB, Google Drive del README)
#    facerecognitionsdk.aar  ->  myapp/android/app/libs/
#    (NO se versiona: *.aar está ignorado y GitHub no acepta >100 MB)

# 2. instalar y sincronizar
npm install
npx cap sync android
```

> **Ojo:** el `.aar` vive en `android/app/libs/`, fuera de `node_modules`, así que
> `npm install` / `npm ci` no lo tocan. Solo cuida ese archivo.

### ¿Por qué `android/app/libs/` y no un módulo Gradle?

AGP rechaza un `.aar` local como dependencia directa de otra librería:

```
Direct local .aar file dependencies are not supported when building an AAR.
```

Pero Capacitor ya genera en `android/app/build.gradle`:

```groovy
repositories {
    flatDir { dirs '../capacitor-cordova-android-plugins/src/main/libs', 'libs' }
}
```

Ese `libs` es `android/app/libs/`. El plugin declara
`implementation(name: 'facerecognitionsdk', ext: 'aar')`, así que Gradle lo
resuelve como módulo desde ese repositorio. **No hace falta** `include
':libfacesdk'` ni crear ningún módulo.

## 3. Cambios obligatorios en Android

| Archivo | Cambio | Por qué |
|---|---|---|
| `AndroidManifest.xml` | `MODIFY_AUDIO_SETTINGS` | único permiso que ningún plugin declara (`CAMERA` y `RECORD_AUDIO` los aporta `@capgo/camera-preview`) |
| `app/build.gradle` | `proguard-android-optimize.txt` | Capacitor genera `proguard-android.txt`, que AGP 9 ya no acepta |
| `variables.gradle` | `minSdk >= 24` | requisito del SDK |
| `app/build.gradle` | sin `abiFilters` | el `.aar` trae `arm64-v8a` y `armeabi-v7a` |

`largeHeap` **no** se toca: lo declara el manifest del plugin vendorizado y el
manifest merger lo fusiona en la app.

El APK crece ~430 MB: es el costo de tener el motor **on-device**.

## 4. Licencia (el paso que bloquea todo)

El SDK no arranca sin una key firmada. El flujo es:

```ts
const mc = await getMachineCode();   // FPMC1... único del equipo
// se envía al proveedor junto al applicationId
const code = await setActivation('FP1...'); // 0 = OK
if (code !== 0) throw new Error(await lastLicenseError());
await init();                        // carga los modelos
```

La demo trae una key válida **solo** para `com.faceplugin.facerecognitionsdk`.
`myapp` usa `com.ejemplo.myapp`, así que devuelve código `1` (licencia inválida)
hasta pedir una key nueva. La pantalla **Plugins → Rostro** muestra el código de
máquina y permite pegar la licencia.

## 5. Uso

```ts
import { faceDetection, templateExtraction, similarity } from 'face-recognition-capacitor';

const [rostro] = await faceDetection('file:///.../foto.jpg', {
  check_liveness: true,
  estimate_age_gender: true,
  check_landmarks: true,
});

const t1 = await templateExtraction(uriA, rostroA);
const t2 = await templateExtraction(uriB, rostroB);
const score = await similarity(t1, t2); // >= 0.67 misma persona
```

En vivo (1:N) se usa `startVideoWorker()` + `subscribeVideoWorker(evento)`:
el nativo emite eventos continuos al JS, no hay `await` por frame.

## 6. Diagnóstico

| Síntoma | Causa |
|---|---|
| `code 1` | licencia de otro appId |
| `code 2` | licencia expirada |
| `code 4` / crash al init | falta el `.aar`, ABI equivocada o poca memoria |
| `not implemented on web` | estás en `localhost`, no en el teléfono |
| emulador no arranca el motor | el `.aar` no trae `x86_64` |

## 7. Continuar en otra máquina

Lo que **sí** viaja por git:

- `src/` (incluye `Rostro.tsx` y `lib/rostro.ts`)
- `vendor/face-recognition-capacitor/` (el plugin completo, 1.8 MB)
- `docs/`, `package.json` / `package-lock.json`

`android/` **no** se versiona: se genera con `npx cap add android`. Pero ese
comando crea la plantilla limpia y **no** repone los parches de la sección 3.

```bash
git clone https://github.com/CarlCRS/PRACTICA-MOVIL.git
cd PRACTICA-MOVIL
npm install
npx cap add android        # solo la primera vez en esa PC
npx cap sync android
# copiar facerecognitionsdk.aar en android/app/libs/
# y aplicar los 2 retoques de abajo
npm run build
cd android && .\gradlew.bat assembleDebug
```

### Los 2 retoques manuales

**1) `android/app/src/main/AndroidManifest.xml`** — una línea al final:

```xml
<!-- CAMERA y RECORD_AUDIO ya los aporta @capgo/camera-preview al fusionar
     manifiestos. Este es el único permiso que hay que declarar a mano. -->
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

**2) `android/app/build.gradle`** — ProGuard (AGP 9 rechaza el default de Capacitor):

```groovy
proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
```

Eso es todo. `largeHeap` viene del manifest del plugin y el `.aar` se resuelve
solo desde `android/app/libs/`.

Lo que **no** viaja y hay que reponer:

| Qué | Cómo |
|---|---|
| `node_modules/` | `npm install` |
| `.env` (key de ElevenLabs) | copiarlo por USB/gestor de secretos. Nunca commitearlo |
| `android/app/libs/facerecognitionsdk.aar` (455 MB) | bajar de Drive o copiarlo por USB |
| SDK/JDK | Android Studio + JDK 21 (`JAVA_HOME`) |

Si el `gradlew` falla con "Unsupported class file major version", es el JDK:
usa 21, no 26.
