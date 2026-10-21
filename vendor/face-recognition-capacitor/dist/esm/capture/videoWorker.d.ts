import type { FaceBox } from '../runtime';
export type VideoWorkerMatch = {
    matched: boolean;
    personIndex?: number;
    score?: number;
};
export type VideoWorkerFace = {
    trackId: number;
    x: number;
    y: number;
    width: number;
    height: number;
    landmarks: {
        x: number;
        y: number;
    }[];
    yaw: number;
    pitch: number;
    roll: number;
    weak: boolean;
    match?: VideoWorkerMatch;
    liveness?: number;
    livenessLabel?: string;
};
export type VideoWorkerTracking = {
    type: 'tracking';
    frameWidth: number;
    frameHeight: number;
    faces: VideoWorkerFace[];
};
export type VideoWorkerMatchEvent = {
    type: 'match';
    trackId: number;
    matched: boolean;
    personIndex?: number;
    score?: number;
};
export type VideoWorkerEvent = VideoWorkerTracking | VideoWorkerMatchEvent;
export declare function parseVideoWorkerEvent(json: string): VideoWorkerEvent | null;
export declare function workerFaceToBox(face: VideoWorkerFace): FaceBox;
