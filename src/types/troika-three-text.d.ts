/**
 * \file troika-three-text.d.ts
 * \brief 
 *
 * \author Stanley Arnaud
 * \date 2026-11-12
 */

declare module "troika-three-text" {
    import * as THREE from "three";

    export class Text extends THREE.Mesh {
        [key: string]: any;

        text: string;
        font: string;
        fontSize: number;

        sync(callback?: () => void): void;
        dispose(): void;
    }
}
