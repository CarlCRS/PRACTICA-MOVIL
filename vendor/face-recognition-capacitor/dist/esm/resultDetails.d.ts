import type { FaceBox } from './runtime';
export type DetailRow = {
    kind: 'section' | 'field';
    title: string;
    value: string;
};
/** Thresholds needed to format result rows (demo Settings stay in the app). */
export type ResultDisplaySettings = {
    liveness_threshold: number;
};
export declare function livenessPassed(settings: ResultDisplaySettings, score: number, label?: string): boolean;
export declare function qualityText(score: number): string;
/** Mirrors Android ResultDetails.rows — known fields + leftover engine attributes. */
export declare function resultDetailRows(box: FaceBox, settings: ResultDisplaySettings, opts?: {
    personName?: string;
    similarity?: number;
    includeMatch?: boolean;
}): DetailRow[];
