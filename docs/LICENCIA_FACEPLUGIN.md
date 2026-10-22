# Licencia FacePlugin — estado, diagnóstico y cómo renovarla

> Referencia del ticket **INGIF-1442** (plugin `face-recognition-capacitor` vendored en `vendor/`).

## Resumen

El SDK funciona así: la licencia demo que viene "quemada" en los repos del vendor
**ya venció**. El motor (`libFaceRecognitionEngine.so`) la rechaza al instante y
`init()` devuelve `4` (INIT_FAILED).

## Diagnóstico (qué descartamos, en orden)

1. Build del AAR ✔ — el `.aar` se resuelve desde `android/app/libs/`
   (flatDir que Capacitor ya declara; sin módulos Gradle extra).
2. Extracción del pack ✔ — `frc.fpk` (425 MB, cifrado FPK3) se extrae bien a
   `<noBackupFilesDir>/.fpr/frc`; `iris_fitter.xml` ausente es inocuo (`iris_enabled=0`).
3. Activación ✔ — `setActivation` → 0; `activation.dat` creado; alias
   `fpplugin.lic` en `license/`.
4. Estado de licencia ✔ — `getLicenseStatus()` = `licensed, level 3
   (RECOGNITION_LIVENESS)`. OJO: este estado revisa el **nivel de permisos**, no la
   fecha de la ventana de prueba.
5. Llamada manual por reflection a `nativeInitEngine` → **`-1` en ~1 ms** — guard
   instantáneo, sin cargar modelos ni leer configs.
6. Cadenas extraídas del `.so` del motor:
   - `"DEMO license expired. Time is over. Trial license: https://fpplg.ai/products/software/face-sdk"`
   - `"license check: date expired."` / `"Trial period is expired."`
   - `"The processing license is not valid"`

**Causa raíz:** la demo key es una licencia de prueba con fecha embebida en su firma
binaria (`FPL1|03 00|01 00|...`) y ya pasó su ventana. El_repo del vendor no documenta
este vencimiento porque asume que la demo siempre está vigente.

## Dónde está la key demo

Todas las fuentes públicas tienen la **misma** key (idéntica byte a byte):

- Repo madre: `Faceplugin-ltd/FaceRecognition-Android` → `MainActivity.kt` (`LICENSE_KEY`)
- Plugin Ionic-Cordova: `Faceplugin-ltd/FaceRecognition-Ionic-Cordova` → `src/license.ts`
- Nuestro `.env` → `VITE_FACEPLUGIN_LICENSE_ANDROID`

No existe key demo pública más fresca.

## Qué hacer: pedir licencia nueva al vendor

La licencia es **offline** y está ligada al `applicationId` / bundle id. El vendor
genera la firma y la entrega por email/Telegram.

Canales oficiales (README del vendor):

| Canal | Contacto |
|---|---|
| Email | `info@faceplugin.com` |
| Telegram | `@FacePluginSupport` |
| WhatsApp | `+1 469 278 4822` |
| Página trial | `https://fpplg.ai/products/software/face-sdk` |
| Docs | `https://doc.faceplugin.com` |

Borrador de mensaje (la licencia viene firmada para el id que indiques):

> Subject: Demo license request — Face Recognition SDK (Capacitor integration)
>
> Hi, I'm evaluating the FacePlugin Face Recognition SDK for a client project
> (Ionic/React + Capacitor, Android first). I'm using your open-source
> FaceRecognition-Ionic-Cordova plugin with the demo applicationId
> `com.faceplugin.facerecognitionsdk`.
>
> The bundled demo key activates correctly (setActivation -> 0, license status
> RECOGNITION_LIVENESS), but init() always returns 4 (INIT_FAILED). Binary
> diagnostics suggest the demo license is time-expired.
>
> Could you please send us a fresh demo/trial license for applicationId
> `com.faceplugin.facerecognitionsdk`? Later we'll need a production license for
> our final app id.
>
> Device machine code: `FPMC1.eyJ2IjoxLCJmcCI6IjE2QjVGODAzRkFDNjZDMDZGMzI5RkRGMzJBOEQ2NTg5Nzc5NzVFODM5MDM4QjNCMDRCQjNBOTFEMjVBMEI1OTYiLCJwbGF0IjoiQU5EUk9JRCIsImFwcCI6MTAwMCwiZG9ja2VyIjowLCJ2bSI6MCwiY2dwdSI6MH0=`

> 💡 Si ya conocen el `applicationId` final del proyecto (INGIF-1442), pedir la
> licencia directa para ese id: es la que se necesitará de todos modos y evita
> repetir el trámite. Con licencia real se revierte el id temporal
> `com.faceplugin.facerecognitionsdk` en `android/app/build.gradle` y `capacitor.config.ts`.

## Cuando llegue la key

1. Remplazar `VITE_FACEPLUGIN_LICENSE_ANDROID` en `.env`.
2. `npm run build` (la key se inyecta en tiempo de *build* vía `import.meta.env`,
   la lee `src/lib/licencia-demo.ts`).
3. `npx cap sync android`.
4. `cd android && gradlew.bat :app:assembleDebug`.
5. `adb install -r android\app\build\outputs\apk\debug\app-debug.apk`.
6. Abrir `/rostro` — la auto-activación hace el resto (machine code → key guardada
   o del `.env` → `setActivation` → `init`).

## Otras rutas evaluadas (por qué no aplican)

- **`Open-Source-Face-Recognition-SDK`** (repo "open source" del vendor): es un SDK
  **Python para Windows/Linux** — no corre en móvil. Solo sirve como backend
  (arquitectura app → servidor), lo que contradice el objetivo on-device del ticket.
- **`FaceRecognition-Ionic-Capacitor`**: es el repo de origen del plugin vendored
  (`vendor/face-recognition-capacitor`). Su `example/src/license.ts` tiene la
  **misma key vencida** (idéntica a la del `.env`), y los binarios del motor no
  están en GitHub (se bajan del Drive — ya hecho: AAR en `android/app/libs/`).
  La integración en sí está bien; el único bloqueo es la licencia.

## Técnico: por qué el estado "licensed" no basta

- `getLicenseStatus()` valida el **nivel** de la licencia (reconocimiento, liveness…).
- El chequeo de vencimiento del modo DEMO ocurre **dentro** de `FacerecService` al
  crear el motor — comparación de fechas pura CPU → falla en ~1 ms con `-1`.
- Códigos de estado del SDK: `0` SUCCESS · `1` INVALID LICENSE · `2` EXPIRED (en
  `setActivation`) · `3` NOT_ACTIVATED · `4` INIT_FAILED (aquí el 2 no se ve porque
  el vencimiento lo detecta el motor, no la capa Java).

## Pendiente tras resolver

- [ ] Quitar el bloque EXPERIMENTO en `vendor/.../FaceRecognitionSdkPlugin.kt`
      (tag `FaceSdkDiag`, patches de `config.json` / `fp_detect.xml`, reflection a
      `nativeInitEngine`).
- [ ] Revertir `applicationId` temporal (si la licencia nueva es para el id propio).
- [ ] Probar detección real en `/rostro`; siguiente nivel: `CaptureSession` del
      vendor para cámara en vivo con overlay.
