/**
 * \file Home.ts
 * \brief 
 *
 * \author Stanley Arnaud
 * \date 2026-11-10
 */

import type { WindowViewport } from "../WindowViewport.ts";

import { Text as TroikaText } from 'troika-three-text'

import * as THREE from "three";
import type { AppContext } from "../AppContext";
import type { View } from "./View";

export default class Home implements View {
    private readonly ctx: AppContext;
    private readonly root = new THREE.Group();

    private viewport: WindowViewport | null = null;

    private width = 0;
    private height = 0;

    private contentHeight = 0;

    private initialized = false;
    private loading = false;

    constructor(appCtx: AppContext) { this.ctx = appCtx; }

    // --------------------------------------------------
    // Mount
    // --------------------------------------------------

    public mount(viewport: WindowViewport): void {
        this.viewport = viewport;

        viewport.content.clear();
        viewport.addContent(this.root);

        viewport.contentHeight = this.contentHeight;

        // Start populating asynchronously,
        // but DON'T await it.
        if (!this.initialized && !this.loading) {
            void this.populate();
        }
    }


    // --------------------------------------------------
    // Populate
    // --------------------------------------------------

    private async populate(): Promise<void> {
        this.loading = true;

        try {
            const url = await this.ctx.getAssetUrl("index.json");
            if (url === null)
                throw new Error("Failed to fetch index.json");

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error("Failed to fetch index.json");
            }

            const index = await response.json();

            let y = 0;

            // ------------------------------------------
            // About heading
            // ------------------------------------------

            const aboutTitle = this.createText(
                "About.",
                32
            );

            aboutTitle.position.set(0, y, 0);

            this.add(aboutTitle);

            await this.syncText(aboutTitle);

            y += this.textHeight(aboutTitle);
            y += 8;

            this.setContentHeight(y);


            // ------------------------------------------
            // About body
            // ------------------------------------------

            const about = this.createText(
                index.about,
                20
            );

            about.position.set(0, y, 0);

            this.add(about);

            await this.syncText(about);

            y += this.textHeight(about);
            y += 32;

            this.setContentHeight(y);


            // ------------------------------------------
            // Projects heading
            // ------------------------------------------

            const projectsTitle = this.createText(
                "Projects.",
                32
            );

            projectsTitle.position.set(0, y, 0);

            this.add(projectsTitle);

            await this.syncText(projectsTitle);

            y += this.textHeight(projectsTitle);
            y += 16;

            this.setContentHeight(y);


            // ------------------------------------------
            // Projects
            // ------------------------------------------

            for (const project of index.projects) {
                const title = this.createText(
                    `- ${project.title}`,
                    20
                );

                title.position.set(0, y, 0);

                this.add(title);

                await this.syncText(title);

                y += this.textHeight(title);

                const desc = this.createText(
                    `${project.description}`,
                    16
                );

                desc.position.set(0, y, 0);

                this.add(desc);

                await this.syncText(desc);

                y += this.textHeight(desc);
                y += 8;

                this.setContentHeight(y);


                // --------------------------------------
                // Thumbnail
                // --------------------------------------

                const url = await this.ctx.getAssetUrl(`projects/${project.name}/assets/` + `${project.thumbnail ?? "thumbnail.webp"}`) ?? "";

                const tex =
                    await this.ctx.textureLoader.loadAsync(url);
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.minFilter = THREE.NearestFilter;
                tex.magFilter = THREE.NearestFilter;

                const aspect =
                    tex.image.height /
                    tex.image.width;

                const imageWidth =
                    Math.min(this.width, 600);

                const imageHeight =
                    imageWidth * aspect;

                const picture = new THREE.Mesh(
                    this.ctx.geometry,
                    new THREE.MeshBasicMaterial({
                        map: tex,
                        transparent: true,
                        side: THREE.DoubleSide
                    })
                );

                picture.userData.clickable = true;
                picture.userData.href = `projects/${project.name}/${project.name}.md`;

                picture.position.set(0, y, 0);

                picture.scale.set(
                    imageWidth,
                    imageHeight,
                    1
                );

                this.add(picture);

                y += imageHeight;
                y += 24;

                this.setContentHeight(y);
            }

            this.initialized = true;
        }
        catch (error) {
            console.error(
                "Failed to populate Home view:",
                error
            );
        }
        finally {
            this.loading = false;
        }
    }


    // --------------------------------------------------
    // Add progressively
    // --------------------------------------------------

    private add(object: THREE.Object3D): void {
        this.root.add(object);

        /*
         * root was already passed through addContent().
         * Newly added children therefore still need
         * the viewport's stencil configuration.
         */
        this.viewport?.configureContent(object);
    }


    // --------------------------------------------------
    // Text
    // --------------------------------------------------

    private createText(
        value: string,
        size: number
    ): TroikaText {
        const text = new TroikaText();

        text.text = value;

        text.font = this.ctx.fonts.serif;
        text.fontSize = size;

        text.color = 0x000000;

        text.anchorX = "left";
        text.anchorY = "top";

        text.maxWidth = this.width;

        text.whiteSpace = "normal";
        text.overflowWrap = "break-word";

        // Your UI uses Y-down coordinates.
        text.scale.y = -1;

        return text;
    }

    private syncText(
        text: TroikaText
    ): Promise<void> {
        return new Promise((resolve) => {
            text.sync(resolve);
        });
    }

    private textHeight(
        text: TroikaText
    ): number {
        const bounds =
            text.textRenderInfo.blockBounds;

        return bounds[3] - bounds[1];
    }


    // --------------------------------------------------
    // Content height / invalidation
    // --------------------------------------------------

    private setContentHeight(
        height: number
    ): void {
        this.contentHeight = height;

        if (this.viewport) {
            this.viewport.contentHeight = height;
        }

        // this.ctx.invalidateLayout();
    }


    // --------------------------------------------------
    // Layout
    // --------------------------------------------------

    public async layout(
        width: number,
        height: number
    ): Promise<void> {
        if (
            this.width === width &&
            this.height === height
        ) {
            return;
        }

        this.width = width;
        this.height = height;

        /*
         * Eventually:
         *
         * - update Text.maxWidth
         * - await text.sync()
         * - reposition following blocks
         * - update contentHeight
         *
         * For a fixed virtual 800x600 display this
         * may rarely/never need to happen.
         */
    }


    // --------------------------------------------------
    // Dispose
    // --------------------------------------------------

    public dispose(): void {
        this.root.traverse((object) => {
            if (object instanceof TroikaText) {
                object.dispose();
            }
        });

        this.root.clear();
    }
}
