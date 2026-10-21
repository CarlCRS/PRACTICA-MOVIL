/** Parsed FaceRecognitionSDK.getLicenseStatus JSON — same contract as native LicenseStatus. */
export const NOT_LICENSED = {
    licensed: false,
    level: -1,
    levelName: 'None',
    recognition: false,
    liveness: false,
    label: 'Not licensed',
};
export function parseLicenseStatus(json) {
    try {
        const o = JSON.parse(json || '{}');
        if (!o || typeof o !== 'object' || Array.isArray(o))
            return NOT_LICENSED;
        const label = typeof o.label === 'string' && o.label.trim() ? o.label : 'Not licensed';
        return {
            licensed: Boolean(o.licensed),
            level: typeof o.level === 'number' ? o.level : -1,
            levelName: typeof o.levelName === 'string' ? o.levelName : 'None',
            recognition: Boolean(o.recognition),
            liveness: Boolean(o.liveness),
            label,
        };
    }
    catch (_a) {
        return NOT_LICENSED;
    }
}
/** Home status bar after a successful init — Android `Ready · %s`. */
export function readyStatusMessage(label) {
    const t = (label || '').trim();
    return t ? `Ready · ${t}` : 'Ready';
}
//# sourceMappingURL=licenseStatus.js.map