// WRAPPER cámara preview: @capgo/camera-preview
// Idea clave: la cámara va DETRÁS del WebView (toBack:true) y tu UI es un overlay.
// Por eso la página debe poner IonContent transparente mientras el preview vive.
import { CameraPreview } from '@capgo/camera-preview';

export async function pedirPermisosCamara() {
  const r = await CameraPreview.requestPermissions({ disableAudio: false });
  const cam = (r as any).camera ?? (r as any).cameraPreview ?? 'granted';
  if (cam === 'denied') throw new Error('Permiso de cámara denegado');
  return r;
}

export async function iniciarPreview() {
  await pedirPermisosCamara().catch(() => {});
  await CameraPreview.start({
    position: 'rear',
    toBack: true, // cámara detrás, tu HTML encima
    storeToFile: false, // false = capture() devuelve base64 directo
    disableAudio: true, // true = no pide micrófono (solo foto)
  });
}

export async function detenerPreview() {
  await CameraPreview.stop().catch(() => {});
}

export async function tomarFoto(): Promise<string> {
  const r = await CameraPreview.capture({ quality: 85 });
  return `data:image/jpeg;base64,${r.value}`;
}

export async function girarCamara() {
  await CameraPreview.flip();
}
