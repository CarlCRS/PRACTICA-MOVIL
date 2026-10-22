# Setup de Runtimes Nativos (leer tras un `git clone` limpio)

> ¿Por qué este doc existe? Porque los binarios de terceros (SDKs biometricos,
> modelos de IA, frameworks nativos) **no están en GitHub** — se distribuyen por
> Google Drive u otro medio, y un clone no los trae. Si intentas compilar sin
> ellos, Gradle/Pods fallan a mitad del camino con errores crípticos.
> El guard `node scripts/check-runtimes.js` (ejecutado por `postinstall`)
> avisa lo que falta ANTES de que explote el build.

---

## Regla de oro para cada repo que integres (aplica a FacePhi real)

Cuando incorpores un *vendor* repo:

1. **Lee primero su README sección "Get the runtimes / Download / Install".**
2. Anota los binarios que promet que NO vienen por git y dónde deben quedar.
3. Copialos EN LA RUTA EXACTA indicada (Android: `android/libs/*.aar durante`).
4. NUNCA los communities (peso + términos de licencia → los docs del repo lo prohiben).
5. Registra el binario en `scripts/check-runtimes.js` — así el próximo clone se detecta solo.

---

## Runtimes del proyecto PRACTICA-MOVIL (oct 2026)

### 1. FacePlugin FaceRecognition (plugin híbrido vendored)

Repo: https://github.com/Faceplugin-ltd/FaceRecognition-Ionic-Capacitor
Vendored: `vendor/face-recognition-capacitor` (linkeado en `android/capacitor.settings.gradle`)

| Plataforma | Binario | Copiar EXACTAMENTE en | Descarga |
|---|---|---|---|
| Android | `facerecognitionsdk.aar` | `android/app/libs/` | [Drive Android](https://drive.google.com/drive/folders/1kpzYVv9Gbm_pEpDe9-x7FGB4NWZzvez0) |
| iOS | `facerecognitionsdk.framework` | `vendor/face-recognition-capacitor/ios/Frameworks/` | [Drive iOS](https://drive.google.com/drive/folders/1PKmV-o7gq7s7dDtiNgXPfCi2ZlWaRy5H) |
| iOS | `FaceRecognitionEngine.framework` | `vendor/face-recognition-capacitor/ios/Frameworks/` | (mismo pack) |
| iOS | `onnxruntime.framework` | `vendor/face-recognition-capacitor/ios/Frameworks/` | (mismo pack) |

El pack Android viene con los modelos (`frc.fpk`) incluidos; el pack iOS trae los
frameworks device arm64 (no corren en solator — prueba en teléfono físico).

### ⚠️ Por qué el .aar va en `android/app/libs/` y NO en `vendor/.../libs/`

El plugin FacePlugin es un módulo **library** de Android. AGP **prohíbe** que un
library dependa de un `.aar` local con `implementation files(...)`:

```
Direct local .aar file dependencies are not supported when building an AAR.
```

La solución (sin módulos Gradle extra) es que el `.aar` viva en la carpeta
`android/app/libs/`: Capacitor ya declara en `app/build.gradle`:

```gradle
repositories {
  flatDir { dirs '../capacitor-cordova-android-plugins/src/main/libs', 'libs' }
}
```

y el vendor build.gradle lo resuelve con `implementation(name: 'facerecognitionsdk', ext: 'aar')`
desde ese flatDir. **No** hace falta declarar `:libfacesdk` (el patrón anterior del
módulo envoltorio quedó obsoleto).

Si el `.aar` queda en `vendor/.../android/libs/`, el vendor lo usa como
"bundledAar" (ramificación de mayor prioridad) y el build vuelve a fallar con el
error de arriba. **Muévelo, no lo copies.**

### Orden de trabajo (Android SDK completo)

```bash
# 1. Descarga el AAR del Drive (uniforme, navegador — drive no admite curl sin cookies)
# 2. Colócalo:
#    android\app\libs\facerecognitionsdk.aar
#    (NO en vendor\...\android\libs\ — ver advertencia abajo)
# 3. Verifica:
node scripts/check-runtimes.js
# 4. Sincroniza y compila:
npx cap sync
npx cap run android        # o abre android/ en Android Studio
```

### Después de actualizar el vendor repo (`git pull` en vendor/)
`git pull` trae código nuevo, no el binario. Si el vendor cambió de versión
Kotlin/Gradle o hizomis un AAR nuevo, **baja el AAR nuevo del Drive y replázcalo.**

---

## Licencia del SDK facial (por qué falla `LICENSE_FILE_NOT_FOUND`)

La key **no es un archivo que se coloca a mano**. Flujointerno del AAR
(verificado con javap + strings):

```
setActivation("FP1.…")                  ← key como STRING, la pasa el código JS
   └─ guarda <files>/facerecognitionsdk/activation.dat
   └─ LicenseBridge → nativeSetIdentity(<packageName>)   ← firma contra el appId

init()
   └─ extrae assets/facerecognitionsdk/frc.fpk → <files>/.fpr/frc
   └─ motor busca license.lic en <files>/.fpr/frc/license/
      └─ sin key válida → LICENSE_FILE_NOT_FOUND
      └─ key de otro appId → LICENSE_MACHINE_MISMATCH / WRONG_PRODUCT
      └─ key vieja         → LICENSE_EXPIRED
```

Constantes reales en `libFaceRecognitionSDK.so`: `LICENSE_OK`,
`LICENSE_FILE_NOT_FOUND`, `LICENSE_MACHINE_MISMATCH`, `LICENSE_WRONG_PRODUCT`,
`LICENSE_EXPIRED`, `LICENSE_NOT_LOADED`, `LICENSE_INSTANCE_LIMIT`, …

### Estados del proyecto

- **Ahora (desarrollo):** applicationId temporal = `com.faceplugin.facerecognitionsdk`
  (demo del vendor). La key demo vive en `.env` (gitignored):
  `VITE_FACEPLUGIN_LICENSE_ANDROID` / `VITE_FACEPLUGIN_LICENSE_IOS`, se lee en
  `src/lib/licencia-demo.ts` y `/rostro` se **auto-activa al abrir**. Plantilla:
  `.env.example`. TODO demo: NO commitear keys reales en producción.
- **Volver al id propio:** en `android/app/build.gradle` poner
  `applicationId "com.ejemplo.myapp"`, en `capacitor.config.ts` su `appId`, pedir
  licencia real al proveedor enviando el machine code (`FPMC1…`) que muestra
  `/rostro`, y activar con el `FP1…` que devuelvan.
- **Lección para FacePhi real:** nunca use la key"genérica"; pida licencia por
  deviceId + applicationId — flujo idéntico al de la Opción B.

---

## Cómo Integrar un TERMINAL vendor nuevo (checklist KPI)

- [ ] ¿Qué binarios promet más ALL de git? (leer README "runtimes").
- [ ] ¿Requiere licencia key en runtime? (FacePhi real: sí — se instancia por deviceId).
- [ ] ¿Dónde se coloco cada bin ruta?  → agréguela a `scripts/check-runtimes.js`.
- [ ] ¿Compila minSdk/compileSdk compatible con tu proyecto Android (34/36)?
- [ ] ¿El plugin iOS usa CocoaPods o SPM? (line, `pod install` al probar).
- [ ] Documentar en este archivo `docs/SETUP_RUNTIMES.md` con los links de descarga.

---

## Troubleshooting rápido

| Síntoma | Causa probable | Fix |
|---|---|---|
| `Missing facerecognitionsdk.aar` en Gradle | AAR no copiado a `android/app/libs/` | mover el .aar ahí |
| `Direct local .aar file dependencies are not supported...` | el .aar quedó en `vendor/.../android/libs/` (bundledAar tiene prioridad) | moverlo a `android/app/libs/` (no copiarlo) |
| Ionic corre en web pero nada nativo | `npx cap sync` no se ejecutó | sync + rebuild |
| Gradle timeout / HTTP 403 al primer build | proxy/VPN corte | prueba de nuevo; borra `~/.gradle/caches` |
| AAR compilado pero crash al runtime: `frc.fpk not found` | pack descargado incompleto | re-descargar completo (con modelos) |

---

## Errores que NO son de runtimes (para no mezclar)

- `SDK location not found` → crea `local.properties` con `sdk.dir` (Android Studio lo crea al abrir).
- `Unsupported class file major version` → JDK no es 17 (instala Temurin 17).
- Kapt/Kotlin plugin version mismatch → revisa AGP/Kotlin versions en `android/build.gradle`.
