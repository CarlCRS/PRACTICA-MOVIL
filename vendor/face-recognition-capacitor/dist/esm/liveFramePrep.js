/**
 * Single live-frame geometry policy for Android + iOS.
 * JS owns all front/back / landscape branching; native only rotates + scales.
 *
 * `width` / `height` must be after EXIF / UIImage orientation bake (from probeLiveImage).
 * VisionCamera `orientation` is accepted for API completeness / future use; the
 * post-bake aspect ratio is what drives the rotation today.
 */
export const LIVE_FRAME_MAX_EDGE = 640;
/**
 * Decide rotateDegrees + maxEdge for VideoWorker / side-detect frames.
 *
 * 1. Landscape (w > h): front −90°, back +90° (CameraFrameUtils).
 * 2. Else if front on iOS: +180° (front sensor mount vs VisionCamera portrait bake).
 * 3. Else: 0° (Android front portrait stays upright).
 */
export function planLiveFrame(input) {
    var _a;
    const maxEdge = input.maxEdge != null && input.maxEdge > 0
        ? Math.floor(input.maxEdge)
        : LIVE_FRAME_MAX_EDGE;
    const w = Number(input.width) || 0;
    const h = Number(input.height) || 0;
    const platform = ((_a = input.platform) !== null && _a !== void 0 ? _a : '').toLowerCase();
    let rotateDegrees = 0;
    if (w > h) {
        rotateDegrees = input.frontCamera ? -90 : 90;
    }
    else if (input.frontCamera && platform !== 'android') {
        rotateDegrees = 180;
    }
    return { rotateDegrees, maxEdge };
}
//# sourceMappingURL=liveFramePrep.js.map