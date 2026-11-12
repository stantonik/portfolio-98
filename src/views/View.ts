/**
 * \file View.ts
 * \brief 
 *
 * \author Stanley Arnaud
 * \date 2026-11-11
 */

import type { WindowViewport } from "../WindowViewport.ts";

export interface View {
    mount(viewport: WindowViewport): void;
    layout(width: number, height: number): Promise<void>;
    dispose(): void;
}
