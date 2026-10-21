import { WebPlugin } from '@capacitor/core';
import type { FaceRecognitionSdkPlugin } from './definitions';
export declare class FaceRecognitionSdkWeb extends WebPlugin implements FaceRecognitionSdkPlugin {
    getMachineCode(): Promise<{
        value: string;
    }>;
    setActivation(): Promise<{
        value: number;
    }>;
    init(): Promise<{
        value: number;
    }>;
    deinit(): Promise<void>;
    lastLicenseError(): Promise<{
        value: string;
    }>;
    getLicenseStatus(): Promise<{
        value: string;
    }>;
    setLandmarkMode(): Promise<{
        value: number;
    }>;
    getLandmarkMode(): Promise<{
        value: number;
    }>;
    detect(): Promise<{
        value: string;
    }>;
    faceDetection(): Promise<{
        value: string;
    }>;
    templateExtraction(): Promise<{
        value: string;
    }>;
    cropFace(): Promise<{
        value: string;
    }>;
    extractFeature(): Promise<{
        value: string;
    }>;
    similarity(): Promise<{
        value: number;
    }>;
    quality(): Promise<{
        value: string;
    }>;
    startVideoWorker(): Promise<{
        value: number;
    }>;
    stopVideoWorker(): Promise<void>;
    syncVideoWorkerDatabase(): Promise<{
        value: number;
    }>;
    probeLiveImage(): Promise<{
        width: number;
        height: number;
    }>;
    applyLiveFrame(): Promise<{
        ingested: boolean;
        width: number;
        height: number;
        uri?: string | null;
    }>;
    exportLastLiveFrame(): Promise<{
        ingested: boolean;
        width: number;
        height: number;
        uri?: string | null;
    }>;
    writeStatus(): Promise<void>;
    estimatorStatus(): Promise<{
        value: string;
    }>;
    startLivePreview(): Promise<void>;
    stopLivePreview(): Promise<void>;
    takeLiveSnapshot(): Promise<{
        uri: string;
        path: string;
    }>;
}
