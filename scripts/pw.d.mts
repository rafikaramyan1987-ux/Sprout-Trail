import type { Browser, LaunchOptions } from 'playwright';
export declare const GL_ARGS: string[];
export declare const EXECUTABLE: string | undefined;
export declare const chromium: { launch(opts?: LaunchOptions): Promise<Browser> };
