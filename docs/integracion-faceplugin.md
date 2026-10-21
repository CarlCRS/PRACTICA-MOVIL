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
# 1. traer el wrapper (MIT) y compilarlo
#    En este repo ya está vendorizado en myapp/vendor/face-recognition-capacitor
#    (src + dist + android + ios = 1.8 MB, se puede versionar).
git clone https://github.com/Faceplugin-ltd/FaceRecognition-Ionic-Capacitor.git faceplugin-demo
cd faceplugin-demo && npm install && npm run build

# 2. copiarlo dentro de la app (así viaja con el repo)
#    myapp/vendor/face-recognition-capacitor/
#    package.json -> "face-recognition-capacitor": "file:vendor/face-recognition-capacitor"

# 3. bajar el runtime (455 MB, Google Drive del README)
#    Android: facerecognitionsdk.aar  ->  myapp/android/libfacesdk/
#    (NO se versiona: *.aar está ignorado, GitHub no acepta >100 MB)

# 4. instalar y sincronizar
cd ../myapp && npm install
npx cap sync android
```

> **Ojo:** si `npm install` reinstala el paquete (CI, `npm ci`, borrar
> `node_modules`), el plugin sigue igual porque el `.aar` **no** vive dentro de
> `node_modules`: vive en `android/libfacesdk/`. Solo cuida ese archivo.

### ¿Por qué el módulo `libfacesdk`?

AGP moderno rechaza un `.aar` local como dependencia directa de otra librería:

```
Direct local .aar file dependencies are not supported when building an AAR.
```

El plugin ya trae la salida: si no encuentra `android/libs/facerecognitionsdk.aar`,
usa `implementation project(':libfacesdk')`. Por eso no hay que tocar su código.

## 3. Cambios obligatorios en Android

| Archivo | Cambio | Por qué |
|---|---|---|
| `AndroidManifest.xml` | `android:largeHeap="true"` | los modelos ONNX no caben en el heap normal |
| `AndroidManifest.xml` | `CAMERA` | la demo usa `@capacitor/camera` |
| `settings.gradle` + `libfacesdk/` | módulo envoltorio del `.aar` | AGP no acepta `.aar` local directo |
| `variables.gradle` | `minSdk >= 24` | requisito del SDK |
| `app/build.gradle` | sin `abiFilters` | el `.aar` trae `arm64-v8a` y `armeabi-v7a` |

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
# reaplicar los 3 parches (abajo)
npx cap sync android
npm run build
cd android && .\gradlew.bat assembleDebug
```

### Los 3 parches manuales

**1) `android/app/src/main/AndroidManifest.xml`**

```xml
<application
    android:allowBackup="true"
    android:largeHeap="true"        <!-- añadir: los modelos ONNX pesan mucho -->
    ...>

<!-- al final, junto a INTERNET -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

**2) `android/settings.gradle`**

```groovy
include ':libfacesdk'
project(':libfacesdk').projectDir = new File('./libfacesdk')
```

**3) `android/libfacesdk/build.gradle`** (crear el archivo)

```groovy
// AGP 8+/9 prohíbe un .aar local como dependencia directa de otra librería.
def aar = file("facerecognitionsdk.aar")
if (!aar.exists()) {
    throw new GradleException("Falta android/libfacesdk/facerecognitionsdk.aar")
}
configurations.maybeCreate("default")
artifacts.add("default", aar)
```

Además, en `android/app/build.gradle`, la línea de ProGuard debe ser
`proguard-android-optimize.txt` (Capacitor la genera como `proguard-android.txt`).

Lo que **no** viaja y hay que reponer:

| Qué | Cómo |
|---|---|
| `node_modules/` | `npm install` |
| `.env` (key de ElevenLabs) | copiarlo por USB/gestor de secretos. Nunca commitearlo |
| `android/libfacesdk/facerecognitionsdk.aar` (455 MB) | bajar de Drive o copiarlo por USB |
| SDK/JDK | Android Studio + JDK 21 (`JAVA_HOME`) |

Si el `gradlew` falla con "Unsupported class file major version", es el JDK:
usa 21, no 26.
