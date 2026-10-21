import { cropFace, exportLastLiveFrame, faceDetection, startLivePreview, startVideoWorker, stopLivePreview, stopVideoWorker, subscribeVideoWorker, } from '../runtime';
import { workerFaceToBox } from './videoWorker';
import { checkFace, mergeEyes, mergeLiveness, warningFor, } from './captureLogic';
export class CaptureSession {
    constructor(opts) {
        this.frameSize = { w: 480, h: 640 };
        this.lastBoxes = [];
        this.unsubscribe = null;
        this.cancelled = false;
        this.capturing = false;
        this.settings = opts.settings;
        this.onState = opts.onState;
        this.onCaptured = opts.onCaptured;
    }
    /** Native front preview is mirrored on both platforms; engine frames are not. */
    get overlayMirror() {
        return this.settings.camera_lens === 'front';
    }
    async start() {
        this.cancelled = false;
        this.capturing = false;
        await startLivePreview(this.settings.camera_lens === 'front');
        this.unsubscribe = subscribeVideoWorker((ev) => {
            if (this.cancelled || this.capturing || ev.type !== 'tracking')
                return;
            if (ev.frameWidth > 0 && ev.frameHeight > 0) {
                this.frameSize = { w: ev.frameWidth, h: ev.frameHeight };
            }
            const merged = mergeEyes(mergeLiveness(ev.faces.map(workerFaceToBox), []), [], this.overlayMirror);
            this.lastBoxes = merged;
            const state = checkFace(merged, this.settings, this.frameSize);
            this.onState(state, warningFor(state), merged, this.frameSize);
        });
        await startVideoWorker({ matchThreshold: 0.8 });
    }
    async stop() {
        var _a;
        this.cancelled = true;
        (_a = this.unsubscribe) === null || _a === void 0 ? void 0 : _a.call(this);
        this.unsubscribe = null;
        await stopVideoWorker();
        await stopLivePreview();
    }
    async captureNow(boxes) {
        var _a, _b, _c;
        if (this.capturing)
            return null;
        this.capturing = true;
        try {
            await stopVideoWorker();
            const exported = await exportLastLiveFrame();
            const uri = exported.uri;
            if (!uri)
                return null;
            if (exported.width > 0 && exported.height > 0) {
                this.frameSize = { w: exported.width, h: exported.height };
            }
            let box = (_b = (_a = boxes[0]) !== null && _a !== void 0 ? _a : this.lastBoxes[0]) !== null && _b !== void 0 ? _b : null;
            try {
                const detected = await faceDetection(uri, {
                    allAttributes: true,
                    check_liveness: true,
                    check_liveness_level: this.settings.liveness_level,
                });
                box = (_c = detected[0]) !== null && _c !== void 0 ? _c : box;
            }
            catch (_d) {
                // keep tracker box
            }
            if (!box)
                return null;
            let cropB64 = null;
            try {
                cropB64 = await cropFace(uri, box);
            }
            catch (_e) {
                cropB64 = null;
            }
            const result = { uri, faceBox: box, cropB64 };
            this.onCaptured(result);
            return result;
        }
        finally {
            this.capturing = false;
        }
    }
}
//# sourceMappingURL=CaptureSession.js.map