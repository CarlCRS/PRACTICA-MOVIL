import { exportLastLiveFrame, faceDetection, startLivePreview, startVideoWorker, stopLivePreview, stopVideoWorker, subscribeVideoWorker, syncVideoWorkerDatabase, } from '../runtime';
import { workerFaceToBox } from '../capture/videoWorker';
import { mergeLiveness } from '../capture/captureLogic';
export class IdentifySession {
    constructor(opts) {
        this.lastLiveness = [];
        this.frameSize = { w: 480, h: 640 };
        this.lastUri = null;
        this.unsubscribe = null;
        this.cancelled = false;
        this.workerReady = false;
        this.livBusy = false;
        this.lastLivenessMs = 0;
        this.pollPromise = null;
        this.settings = opts.settings;
        this.featureTemplates = opts.featureTemplates;
        this.onTracking = opts.onTracking;
        this.onMatch = opts.onMatch;
    }
    /** Native front preview is mirrored on both platforms; engine frames are not. */
    get overlayMirror() {
        return this.settings.frontCamera;
    }
    async start() {
        this.cancelled = false;
        await startLivePreview(this.settings.frontCamera);
        this.unsubscribe = subscribeVideoWorker((ev) => {
            var _a, _b, _c;
            if (this.cancelled)
                return;
            if (ev.type === 'tracking') {
                if (ev.frameWidth > 0 && ev.frameHeight > 0) {
                    this.frameSize = { w: ev.frameWidth, h: ev.frameHeight };
                }
                let next = ev.faces.map(workerFaceToBox);
                next = mergeLiveness(next, this.lastLiveness);
                this.onTracking(next, this.frameSize);
                for (const f of ev.faces) {
                    if (((_a = f.match) === null || _a === void 0 ? void 0 : _a.matched) && f.match.personIndex != null) {
                        this.onMatch(f.match.personIndex, (_b = f.match.score) !== null && _b !== void 0 ? _b : 0);
                        break;
                    }
                }
            }
            else if (ev.type === 'match' && ev.matched && ev.personIndex != null) {
                this.onMatch(ev.personIndex, (_c = ev.score) !== null && _c !== void 0 ? _c : 0);
            }
        });
        const started = await startVideoWorker({
            matchThreshold: this.settings.matchThreshold,
        });
        const synced = await syncVideoWorkerDatabase(this.featureTemplates, this.settings.matchThreshold);
        if (!this.cancelled) {
            this.workerReady = started === 0 && synced === 0;
        }
        this.pollPromise = this.exportLoop();
    }
    leave() {
        this.cancelled = true;
        this.workerReady = false;
    }
    async stop() {
        var _a;
        this.leave();
        (_a = this.unsubscribe) === null || _a === void 0 ? void 0 : _a.call(this);
        this.unsubscribe = null;
        await this.pollPromise;
        this.pollPromise = null;
        await stopVideoWorker();
        await stopLivePreview();
    }
    async dispose() {
        await this.stop();
    }
    async exportLoop() {
        var _a, _b;
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const interval = (_a = this.settings.frameIntervalMs) !== null && _a !== void 0 ? _a : 120;
        while (!this.cancelled) {
            if (!this.workerReady) {
                await sleep(80);
                continue;
            }
            try {
                const exported = await exportLastLiveFrame();
                if (exported.uri)
                    this.lastUri = exported.uri;
                const now = Date.now();
                const livInterval = (_b = this.settings.livenessIntervalMs) !== null && _b !== void 0 ? _b : 450;
                if (exported.uri &&
                    !this.cancelled &&
                    !this.livBusy &&
                    now - this.lastLivenessMs >= livInterval) {
                    this.lastLivenessMs = now;
                    this.livBusy = true;
                    try {
                        if (this.cancelled)
                            return;
                        const liv = await faceDetection(exported.uri, {
                            check_liveness: true,
                            check_liveness_level: this.settings.livenessLevel,
                        });
                        if (liv.length > 0)
                            this.lastLiveness = liv;
                    }
                    catch (_c) {
                        // FaceBox.liveness copy is optional while the camera warms up.
                    }
                    finally {
                        this.livBusy = false;
                    }
                }
            }
            catch (_d) {
                // Export optional until the camera warms up.
            }
            await sleep(interval);
        }
    }
}
//# sourceMappingURL=IdentifySession.js.map