import { type FaceBox } from '../runtime';
import { type CaptureState } from './captureLogic';
import type { CaptureResult, CaptureSettings } from './types';
export type CaptureSessionOptions = {
    settings: CaptureSettings;
    onState: (state: CaptureState, warning: string, boxes: FaceBox[], frame: {
        w: number;
        h: number;
    }) => void;
    onCaptured: (result: CaptureResult) => void;
};
export declare class CaptureSession {
    readonly settings: CaptureSettings;
    readonly onState: CaptureSessionOptions['onState'];
    readonly onCaptured: CaptureSessionOptions['onCaptured'];
    frameSize: {
        w: number;
        h: number;
    };
    lastBoxes: FaceBox[];
    private unsubscribe;
    private cancelled;
    private capturing;
    constructor(opts: CaptureSessionOptions);
    /** Native front preview is mirrored on both platforms; engine frames are not. */
    get overlayMirror(): boolean;
    start(): Promise<void>;
    stop(): Promise<void>;
    captureNow(boxes: FaceBox[]): Promise<CaptureResult | null>;
}
