/**
 * Canonical FaceBox schema matches iOS bridge output:
 * - `attributes`: PascalCase engine map (`"value"` or `"value · NN%"`)
 * - convenience labels: glassesLabel, sunglassesLabel, occlusionLabel, …
 *
 * Android typed FaceBox JSON often omits `attributes` and some labels.
 * This middleware fills the iOS shape without inventing glasses/sunglasses
 * when the engine never returned them.
 */
export type FaceBoxLike = {
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    yaw?: number;
    roll?: number;
    pitch?: number;
    liveness?: number;
    face_quality?: number;
    face_luminance?: number;
    left_eye_closed?: number;
    right_eye_closed?: number;
    face_occlusion?: number;
    mouth_opened?: number;
    age?: number;
    gender?: number;
    livenessLabel?: string;
    genderLabel?: string;
    emotionLabel?: string;
    maskLabel?: string;
    qualityLabel?: string;
    eyesLeftLabel?: string;
    eyesRightLabel?: string;
    glassesLabel?: string;
    sunglassesLabel?: string;
    occlusionLabel?: string;
    attributes?: Record<string, string>;
    landmarkCount?: number;
    landmarks?: number[];
    [key: string]: unknown;
};
/**
 * Identity when `attributes` is already present (iOS / already normalized).
 * Otherwise synthesize an iOS-shaped `attributes` map from typed fields.
 */
export declare function normalizeFaceBox(box: FaceBoxLike): FaceBoxLike;
export declare function normalizeFaceBoxes(boxes: FaceBoxLike[]): FaceBoxLike[];
