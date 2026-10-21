import type { FaceBox } from '../runtime';
/**
 * Thresholds + camera lens for Capture UI.
 * Plain object — no AsyncStorage. Apps/examples pass their own settings.
 */
export type CaptureSettings = {
    camera_lens: 'front' | 'back';
    liveness_threshold: number;
    liveness_level: 0 | 1;
    yaw_threshold: number;
    roll_threshold: number;
    pitch_threshold: number;
    eyeclose_threshold: number;
};
export declare const DEFAULT_CAPTURE_SETTINGS: CaptureSettings;
/** Map demo / app settings onto Capture thresholds (one source of truth). */
export declare function toCaptureSettings(s: {
    camera_lens: 'front' | 'back';
    liveness_threshold: number;
    liveness_level: 0 | 1;
    yaw_threshold: number;
    roll_threshold: number;
    pitch_threshold: number;
    eyeclose_threshold: number;
}): CaptureSettings;
export type CaptureResult = {
    /** Prepared live frame URI (JPEG) used for the successful capture. */
    uri: string;
    faceBox: FaceBox;
    /** Optional face crop JPEG as base64 (NO_WRAP), when available. */
    cropB64?: string | null;
};
