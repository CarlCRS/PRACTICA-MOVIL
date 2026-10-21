import type { FaceBox } from '../runtime';
import type { CaptureSettings } from './types';
export type FrameSize = {
    w: number;
    h: number;
};
export type CaptureState = 'NO_FACE' | 'MULTIPLE_FACES' | 'FIT_IN_CIRCLE' | 'MOVE_CLOSER' | 'NO_FRONT' | 'FACE_OCCLUDED' | 'EYE_CLOSED' | 'SPOOFED_FACE' | 'CAPTURE_OK';
/** Android CaptureView.getROIRect — used by checkFace fit/size tests. */
export declare function getROIRect(frame: FrameSize): {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};
/** Android CaptureView.getROIRect1 — circular guide in the overlay. */
export declare function getROIRect1(frame: FrameSize): {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
};
/** Map frame ROI into view coords — same FILL_CENTER math as mapFramePoint. */
export declare function mapRoiToView(frame: FrameSize, viewW: number, viewH: number): {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
};
/** Preview FILL_CENTER mapping (Android FaceView). */
export declare function mapFramePoint(x: number, y: number, fw: number, fh: number, vw: number, vh: number, mirror: boolean): {
    x: number;
    y: number;
};
export declare function warningFor(state: CaptureState): string;
/** Android CaptureActivity.checkFace */
export declare function checkFace(boxes: FaceBox[], settings: CaptureSettings, frame: FrameSize): CaptureState;
/**
 * Landmark xy in cropFace bitmap pixels — matches Android Utils.mapLandmarksToCrop
 * (1.4× square window scaled to outW×outH).
 */
export declare function mapLandmarksToCrop(faceBox: FaceBox, srcW: number, srcH: number, outW: number, outH: number): {
    x: number;
    y: number;
}[];
export declare function hasLiveness(box: FaceBox): boolean;
export declare function mergeLiveness(track: FaceBox[], pb: FaceBox[]): FaceBox[];
export declare function mergeEyes(track: FaceBox[], pb: FaceBox[], swapLeftRight: boolean): FaceBox[];
