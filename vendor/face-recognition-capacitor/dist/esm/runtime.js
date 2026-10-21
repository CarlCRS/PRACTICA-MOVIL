import { Capacitor, registerPlugin } from '@capacitor/core';
import { normalizeFaceBox, normalizeFaceBoxes, } from './normalizeFaceBox';
import { planLiveFrame, LIVE_FRAME_MAX_EDGE } from './liveFramePrep';
import { parseVideoWorkerEvent, } from './capture/videoWorker';
import { resultDetailRows, livenessPassed, qualityText, } from './resultDetails';
const FaceRecognitionSdkNative = registerPlugin('FaceRecognitionSdk', {
    web: () => import('./web').then((m) => new m.FaceRecognitionSdkWeb()),
});
export async function getMachineCode() {
    const { value } = await FaceRecognitionSdkNative.getMachineCode();
    return value;
}
export async function getLicenseStatus() {
    const { value } = await FaceRecognitionSdkNative.getLicenseStatus();
    return value;
}
export async function setActivation(license) {
    const { value } = await FaceRecognitionSdkNative.setActivation({ license });
    return value;
}
export async function init() {
    const { value } = await FaceRecognitionSdkNative.init();
    return value;
}
export async function deinit() {
    await FaceRecognitionSdkNative.deinit();
}
export async function lastLicenseError() {
    const { value } = await FaceRecognitionSdkNative.lastLicenseError();
    return value;
}
export async function setLandmarkMode(mode) {
    const { value } = await FaceRecognitionSdkNative.setLandmarkMode({ mode });
    return value;
}
export async function getLandmarkMode() {
    const { value } = await FaceRecognitionSdkNative.getLandmarkMode();
    return value;
}
export async function detect(image, crop = false, flags = DETECT_ALL) {
    const { value } = await FaceRecognitionSdkNative.detect({
        image,
        crop,
        flags,
    });
    return value;
}
export async function faceDetection(image, param) {
    const { value } = await FaceRecognitionSdkNative.faceDetection({
        image,
        param: param ? JSON.stringify(param) : null,
    });
    try {
        const parsed = JSON.parse(value);
        return normalizeFaceBoxes(Array.isArray(parsed) ? parsed : []);
    }
    catch (_a) {
        return [];
    }
}
export async function templateExtraction(image, faceBox) {
    const boxJson = typeof faceBox === 'string' ? faceBox : JSON.stringify(faceBox);
    const { value } = await FaceRecognitionSdkNative.templateExtraction({
        image,
        faceBox: boxJson,
    });
    return value;
}
export async function cropFace(image, faceBox) {
    const boxJson = typeof faceBox === 'string' ? faceBox : JSON.stringify(faceBox);
    const { value } = await FaceRecognitionSdkNative.cropFace({
        image,
        faceBox: boxJson,
    });
    return value;
}
export async function extractFeature(image) {
    const { value } = await FaceRecognitionSdkNative.extractFeature({ image });
    return value;
}
export async function similarity(feature1B64, feature2B64) {
    const { value } = await FaceRecognitionSdkNative.similarity({
        feature1: feature1B64,
        feature2: feature2B64,
    });
    return value;
}
export async function quality(image, crop = false) {
    const { value } = await FaceRecognitionSdkNative.quality({ image, crop });
    return value;
}
export async function startVideoWorker(config = { matchThreshold: 0.67 }) {
    const json = typeof config === 'string' ? config : JSON.stringify(config !== null && config !== void 0 ? config : {});
    const { value } = await FaceRecognitionSdkNative.startVideoWorker({
        config: json,
    });
    return value;
}
export async function stopVideoWorker() {
    await FaceRecognitionSdkNative.stopVideoWorker();
}
export async function syncVideoWorkerDatabase(featuresB64, matchThreshold = 0.67) {
    const { value } = await FaceRecognitionSdkNative.syncVideoWorkerDatabase({
        features: featuresB64,
        matchThreshold,
    });
    return value;
}
function normalizeLiveFrameResult(raw) {
    return {
        ingested: Boolean(raw === null || raw === void 0 ? void 0 : raw.ingested),
        width: Number(raw === null || raw === void 0 ? void 0 : raw.width) || 0,
        height: Number(raw === null || raw === void 0 ? void 0 : raw.height) || 0,
        uri: typeof (raw === null || raw === void 0 ? void 0 : raw.uri) === 'string' ? raw.uri : null,
    };
}
function resolveLiveUri(input) {
    if (typeof input === 'string') {
        if (input.startsWith('file://') ||
            input.startsWith('content:') ||
            input.startsWith('data:')) {
            return input;
        }
        if (input.startsWith('/')) {
            return `file://${input}`;
        }
        return input;
    }
    const path = input === null || input === void 0 ? void 0 : input.path;
    if (!path || typeof path !== 'string') {
        throw new Error('ingestLiveCameraFrame: expected a URI string or { path }');
    }
    return path.startsWith('file://') || path.startsWith('content:')
        ? path
        : `file://${path}`;
}
function resolveLiveArgs(input, frontOrOptions, orientationArg) {
    var _a;
    if (typeof input === 'string' || (input && typeof input === 'object' && 'path' in input)) {
        if (typeof frontOrOptions === 'boolean') {
            return {
                uri: resolveLiveUri(input),
                options: {
                    frontCamera: frontOrOptions,
                    orientation: typeof orientationArg === 'string'
                        ? orientationArg
                        : typeof input === 'object'
                            ? input.orientation
                            : undefined,
                },
            };
        }
        const opts = frontOrOptions && typeof frontOrOptions === 'object' ? frontOrOptions : {};
        const photoOrient = typeof input === 'object' && input && 'orientation' in input
            ? input.orientation
            : undefined;
        return {
            uri: resolveLiveUri(input),
            options: {
                frontCamera: opts.frontCamera !== false,
                orientation: (_a = opts.orientation) !== null && _a !== void 0 ? _a : photoOrient,
                rotateDegrees: opts.rotateDegrees,
                maxEdge: opts.maxEdge,
            },
        };
    }
    throw new Error('ingestLiveCameraFrame: invalid arguments');
}
async function prepareAndMaybeFeed(input, frontOrOptions, orientationArg, feedWorker = true) {
    const { uri, options } = resolveLiveArgs(input, frontOrOptions, orientationArg);
    const maxEdge = options.maxEdge != null && options.maxEdge > 0
        ? options.maxEdge
        : LIVE_FRAME_MAX_EDGE;
    let rotateDegrees;
    if (options.rotateDegrees != null && Number.isFinite(options.rotateDegrees)) {
        rotateDegrees = options.rotateDegrees;
    }
    else {
        const probed = await FaceRecognitionSdkNative.probeLiveImage({ image: uri });
        const plan = planLiveFrame({
            frontCamera: options.frontCamera !== false,
            orientation: options.orientation,
            width: Number(probed === null || probed === void 0 ? void 0 : probed.width) || 0,
            height: Number(probed === null || probed === void 0 ? void 0 : probed.height) || 0,
            maxEdge,
            platform: Capacitor.getPlatform(),
        });
        rotateDegrees = plan.rotateDegrees;
    }
    const raw = await FaceRecognitionSdkNative.applyLiveFrame({
        image: uri,
        rotateDegrees,
        maxEdge,
        feedWorker,
    });
    return normalizeLiveFrameResult(raw);
}
export function ingestLiveCameraFrame(input, frontOrOptions, orientation) {
    return prepareAndMaybeFeed(input, frontOrOptions, orientation, true);
}
export async function prepareLiveCameraFrame(input, frontOrOptions, orientation) {
    const result = await prepareAndMaybeFeed(input, frontOrOptions, orientation, false);
    if (!result.uri) {
        throw new Error('prepareLiveCameraFrame: no output URI');
    }
    return result.uri;
}
export async function addVideoWorkerFrame(input, frontOrOptions, orientation) {
    const result = await prepareAndMaybeFeed(input, frontOrOptions, orientation, true);
    return result.ingested ? 0 : 1;
}
export async function exportLastLiveFrame() {
    const raw = await FaceRecognitionSdkNative.exportLastLiveFrame();
    return normalizeLiveFrameResult(raw);
}
export async function writeStatus(payload) {
    await FaceRecognitionSdkNative.writeStatus({
        payload: JSON.stringify(payload),
    });
}
export async function estimatorStatus() {
    const { value } = await FaceRecognitionSdkNative.estimatorStatus();
    return value;
}
export async function startLivePreview(frontCamera = true) {
    if (typeof document !== 'undefined') {
        document.documentElement.classList.add('frs-live-camera');
    }
    await FaceRecognitionSdkNative.startLivePreview({ frontCamera });
}
export async function stopLivePreview() {
    try {
        await FaceRecognitionSdkNative.stopLivePreview();
    }
    finally {
        if (typeof document !== 'undefined') {
            document.documentElement.classList.remove('frs-live-camera');
        }
    }
}
export async function takeLiveSnapshot() {
    const snap = await FaceRecognitionSdkNative.takeLiveSnapshot();
    return { path: snap.path || snap.uri };
}
export function subscribeVideoWorker(cb) {
    let removed = false;
    const handle = FaceRecognitionSdkNative.addListener('FaceRecognitionVideoWorkerEvent', (event) => {
        const ev = parseVideoWorkerEvent(typeof (event === null || event === void 0 ? void 0 : event.json) === 'string' ? event.json : '{}');
        if (ev)
            cb(ev);
    });
    return () => {
        if (removed)
            return;
        removed = true;
        void handle.then((h) => h.remove());
    };
}
export const SDK_SUCCESS = 0;
export const SDK_LICENSE_INVALID = 1;
export const SDK_LICENSE_EXPIRED = 2;
export const SDK_NOT_ACTIVATED = 3;
export const SDK_INIT_FAILED = 4;
export const DETECT_POSE = 1 << 0;
export const DETECT_LANDMARKS = 1 << 1;
export const DETECT_AGE = 1 << 2;
export const DETECT_GENDER = 1 << 3;
export const DETECT_EMOTION = 1 << 4;
export const DETECT_MASK = 1 << 5;
export const DETECT_QUALITY = 1 << 6;
export const DETECT_FACE_QUALITY = 1 << 7;
export const DETECT_EYES = 1 << 8;
export const DETECT_LIVENESS = 1 << 9;
export const DETECT_GLASSES = 1 << 11;
export const DETECT_LIVENESS_ACCURATE = 1 << 16;
export const DETECT_ALL = 0xffffffff;
export const LANDMARK_MODE_14 = 14;
export const LANDMARK_MODE_68 = 68;
export const LANDMARK_MODE_468 = 468;
export { normalizeFaceBox, normalizeFaceBoxes };
export { planLiveFrame, LIVE_FRAME_MAX_EDGE };
export { FaceRecognitionSdkNative as FaceRecognitionSdk };
export { resultDetailRows, livenessPassed, qualityText };
export { parseVideoWorkerEvent, workerFaceToBox, } from './capture/videoWorker';
export { checkFace, warningFor, getROIRect1, mapRoiToView, mapFramePoint, mapLandmarksToCrop, mergeLiveness, mergeEyes, hasLiveness, } from './capture/captureLogic';
export { DEFAULT_CAPTURE_SETTINGS, toCaptureSettings, } from './capture/types';
//# sourceMappingURL=runtime.js.map