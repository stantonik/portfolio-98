/**
 * \file AppContext.ts
 * \brief 
 *
 * \author Stanley Arnaud
 * \date 2026-11-11
 */

import { BufferGeometry, TextureLoader } from "three";

export interface AppContext {
    geometry: BufferGeometry;
    textureLoader: TextureLoader;
    fonts: {
        serif: string;
    };
    getAssetUrl: (path: string) => Promise<string | null>;
}
