import { WebPlugin } from '@capacitor/core';
const MSG = 'Face Recognition SDK requires a native Android or iOS build (npx cap sync).';
export class FaceRecognitionSdkWeb extends WebPlugin {
    async getMachineCode() {
        throw this.unimplemented(MSG);
    }
    async setActivation() {
        throw this.unimplemented(MSG);
    }
    async init() {
        throw this.unimplemented(MSG);
    }
    async deinit() {
        throw this.unimplemented(MSG);
    }
    async lastLicenseError() {
        throw this.unimplemented(MSG);
    }
    async getLicenseStatus() {
        throw this.unimplemented(MSG);
    }
    async setLandmarkMode() {
        throw this.unimplemented(MSG);
    }
    async getLandmarkMode() {
        throw this.unimplemented(MSG);
    }
    async detect() {
        throw this.unimplemented(MSG);
    }
    async faceDetection() {
        throw this.unimplemented(MSG);
    }
    async templateExtraction() {
        throw this.unimplemented(MSG);
    }
    async cropFace() {
        throw this.unimplemented(MSG);
    }
    async extractFeature() {
        throw this.unimplemented(MSG);
    }
    async similarity() {
        throw this.unimplemented(MSG);
    }
    async quality() {
        throw this.unimplemented(MSG);
    }
    async startVideoWorker() {
        throw this.unimplemented(MSG);
    }
    async stopVideoWorker() {
        throw this.unimplemented(MSG);
    }
    async syncVideoWorkerDatabase() {
        throw this.unimplemented(MSG);
    }
    async probeLiveImage() {
        throw this.unimplemented(MSG);
    }
    async applyLiveFrame() {
        throw this.unimplemented(MSG);
    }
    async exportLastLiveFrame() {
        throw this.unimplemented(MSG);
    }
    async writeStatus() {
        throw this.unimplemented(MSG);
    }
    async estimatorStatus() {
        throw this.unimplemented(MSG);
    }
    async startLivePreview() {
        throw this.unimplemented(MSG);
    }
    async stopLivePreview() {
        throw this.unimplemented(MSG);
    }
    async takeLiveSnapshot() {
        throw this.unimplemented(MSG);
    }
}
//# sourceMappingURL=web.js.map