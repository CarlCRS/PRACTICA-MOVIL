/** Parsed FaceRecognitionSDK.getLicenseStatus JSON — same contract as native LicenseStatus. */
export type LicenseStatus = {
    licensed: boolean;
    level: number;
    levelName: string;
    recognition: boolean;
    liveness: boolean;
    label: string;
};
export declare const NOT_LICENSED: LicenseStatus;
export declare function parseLicenseStatus(json?: string | null): LicenseStatus;
/** Home status bar after a successful init — Android `Ready · %s`. */
export declare function readyStatusMessage(label: string): string;
