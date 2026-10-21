import { type FaceBox } from '../runtime';
export type IdentifySettings = {
    frontCamera: boolean;
    matchThreshold: number;
    livenessLevel: 0 | 1;
    frameIntervalMs?: number;
    livenessIntervalMs?: number;
};
export type IdentifySessionOptions = {
    settings: IdentifySettings;
    featureTemplates: string[];
    onTracking: (boxes: FaceBox[], frame: {
        w: number;
        h: number;
    }) => void;
    onMatch: (personIndex: number, score: number) => void;
};
export declare class IdentifySession {
    readonly settings: IdentifySettings;
    readonly featureTemplates: string[];
    readonly onTracking: IdentifySessionOptions['onTracking'];
    readonly onMatch: IdentifySessionOptions['onMatch'];
    lastLiveness: FaceBox[];
    frameSize: {
        w: number;
        h: number;
    };
    lastUri: string | null;
    private unsubscribe;
    private cancelled;
    private workerReady;
    private livBusy;
    private lastLivenessMs;
    private pollPromise;
    constructor(opts: IdentifySessionOptions);
    /** Native front preview is mirrored on both platforms; engine frames are not. */
    get overlayMirror(): boolean;
    start(): Promise<void>;
    leave(): void;
    stop(): Promise<void>;
    dispose(): Promise<void>;
    private exportLoop;
}
