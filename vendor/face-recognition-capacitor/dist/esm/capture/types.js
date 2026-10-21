export const DEFAULT_CAPTURE_SETTINGS = {
    camera_lens: 'front',
    liveness_threshold: 0.5,
    liveness_level: 0,
    yaw_threshold: 40,
    roll_threshold: 40,
    pitch_threshold: 40,
    eyeclose_threshold: 0.5,
};
/** Map demo / app settings onto Capture thresholds (one source of truth). */
export function toCaptureSettings(s) {
    return {
        camera_lens: s.camera_lens,
        liveness_threshold: s.liveness_threshold,
        liveness_level: s.liveness_level,
        yaw_threshold: s.yaw_threshold,
        roll_threshold: s.roll_threshold,
        pitch_threshold: s.pitch_threshold,
        eyeclose_threshold: s.eyeclose_threshold,
    };
}
//# sourceMappingURL=types.js.map