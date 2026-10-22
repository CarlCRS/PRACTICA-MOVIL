// GUARDIA DE RUNTIMES NATIVOS (se ejecuta tras `npm install`)
// ---------------------------------------------------------------------
// POR QUÉ EXISTE: los SDKs biometricos (FacePlugin/FacePhi) distribuyen sus
// binarios (.aar / .xframework) FUERA de GitHub (Google Drive). Un `git clone`
// trae el código, NO los binarios → el build Gradle explota a mitad del camino
// con un error críptico.
//
// Qué hace: lista los binarios requeridos y avisa si falta alguno, con la
// ruta EXACTA donde debe ir y el enlace de descarga. NUNCA debe romper el
// `npm install` (para eso está: si falta, informa y sale OK).
//
// Ejecutar solo (sin instalar):  node scripts/check-runtimes.js
// Modo estricto (falla si falta): RUNTIMES_STRICT=1 node scripts/check-runtimes.js

import fs from "node:fs";
import path from "node:path";

const AAR = path.join("android", "app", "libs", "facerecognitionsdk.aar");
// Ubicación INCORRECTA: si el .aar queda en vendor/.../libs/, el buildscript
// del vendor lo toma como "bundledAar" y el build falla con el error de AGP:
//   "Direct local .aar file dependencies are not supported when building an AAR."
const WRONG_AAR_SPOT = path.join(
  "vendor",
  "face-recognition-capacitor",
  "android",
  "libs",
  "facerecognitionsdk.aar",
);

const IOS_DIR = path.join("vendor", "face-recognition-capacitor", "ios", "Frameworks");
const IOS_FRAMEWORKS = [
  "facerecognitionsdk.framework",
  "FaceRecognitionEngine.framework",
  "onnxruntime.framework",
];

const DRIVE_ANDROID =
  "https://drive.google.com/drive/folders/1kpzYVv9Gbm_pEpDe9-x7FGB4NWZzvez0";
const DRIVE_IOS =
  "https://drive.google.com/drive/folders/1PKmV-o7gq7s7dDtiNgXPfCi2ZlWaRy5H";

const Bar = (s) => console.log(s);
Bar("");
Bar("══════════ Chequeo de runtimes nativos (FacePlugin) ══════════");

// ---------- ANDROID: .aar único --------------------------------------------
const aarOk = fs.existsSync(AAR);
if (aarOk) {
  Bar(`✔ Android: ${AAR}`);
} else if (fs.existsSync(WRONG_AAR_SPOT)) {
  Bar(`✘ ANDROID: el .aar está en la carpeta EQUIVOCADA:`);
  Bar(`      ${WRONG_AAR_SPOT}`);
  Bar(`   Allí el vendor lo usa como dependencia directa y AGP falla:`);
  Bar(`   "Direct local .aar dependencies are not supported when building an AAR."`);
  Bar(`   MUÉVELO a:`);
  Bar(`      ${AAR}`);
} else {
  Bar(`✘ ANDROID: falta el runtime del SDK de reconocimiento facial`);
  Bar(`   1) Descarga el pack Android: ${DRIVE_ANDROID}`);
  Bar(`   2) Copia facerecognitionsdk.aar EXACTAMENTE a esta ruta:`);
  Bar(`      ${AAR}`);
  Bar(`   3) npx cap sync && npx cap run android`);
  Bar(`   (el plugin Android NO compila sin este binario)`);
}

// ---------- iOS: 3 frameworks (opcional; solo compila en macOS) ------------
let faltantes = [];
if (fs.existsSync(IOS_DIR)) {
  faltantes = IOS_FRAMEWORKS.filter(
    (f) => !fs.existsSync(path.join(IOS_DIR, f)),
  );
}
const iosOk = fs.existsSync(IOS_DIR) && faltantes.length === 0;

if (!fs.existsSync(IOS_DIR)) {
  Bar(`⊘ iOS: carpeta ${IOS_DIR} no existe`);
  Bar(`   Si vas a compilar iOS (macOS): descarga el pack iOS`);
  Bar(`   ${DRIVE_IOS}`);
  Bar(`   y copia en ${IOS_DIR}:`);
  for (const f of IOS_FRAMEWORKS) Bar(`      ${f}`);
} else if (iosOk) {
  Bar(`✔ iOS runtimes: los 3 frameworks están (device arm64)`);
} else {
  Bar(`⊘ iOS: carpetas incompletas — faltan:`);
  for (const f of faltantes) Bar(`      ${IOS_DIR}/${f}`);
  Bar(`   Descarga el pack de: ${DRIVE_IOS}`);
}

// ---------- Resumen --------------------------------------------------------
Bar("");
if (aarOk && iosOk) {
  Bar("RUNTIMES OK: puedes compilar Android e iOS.");
} else if (aarOk) {
  Bar("Estado: Android listo — iOS pendiente (no bloquea el build Android).");
} else {
  Bar("Estado: ANDROID NO COMPILA hasta que copies el .aar de arriba.");
}
Bar("═══════════════════════════════════════════════════════════════");
Bar("");

const strict = !!process.env.RUNTIMES_STRICT;
if (strict && !aarOk) {
  console.error("[RUNTIMES_STRICT] Faltan runtimes: ver abajo/instrucciones.");
  process.exit(1);
}
process.exit(0);
