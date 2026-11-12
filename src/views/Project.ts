/**
 * \file Project.ts
 * \brief 
 *
 * \author Stanley Arnaud
 * \date 2026-11-11
 */

import type { View } from "./View";

import * as THREE from "three";
import { Text as TroikaText } from "troika-three-text";

import {
    fromMarkdown
} from "mdast-util-from-markdown";

import {
    gfm
} from "micromark-extension-gfm";

import type {
    Root,
    RootContent,
    PhrasingContent,
    Paragraph,
    Heading,
    List,
    ListItem,
    Image,
    Code,
    Blockquote,
} from "mdast";

import type { AppContext } from "../AppContext";
import type { WindowViewport } from "../WindowViewport.ts";


interface TextStyle {
    font?: string;
    size?: number;
    color?: THREE.ColorRepresentation;
}


interface RichText {
    text: string;

    styleRanges: Record<
        number,
        {
            font?: string;
            size?: number;
            color?: THREE.ColorRepresentation;
        } | null
    >;
}


export default class Project implements View {
    private readonly ctx: AppContext;
    private readonly markdownPath: string;
    private readonly root = new THREE.Group();

    private viewport: WindowViewport | null = null;

    private width = 0;
    private height = 0;

    private contentHeight = 0;

    /**
     * Used to invalidate an old asynchronous build if
     * the view is mounted again before loading finishes.
     */
    private generation = 0;


    constructor(appCtx: AppContext, mdPath: string) { this.ctx = appCtx; this.markdownPath = mdPath; }


    // ==================================================
    // Lifecycle
    // ==================================================

    public mount(viewport: WindowViewport): void {
        this.viewport = viewport;

        // Invalidate any previous asynchronous build.
        ++this.generation;

        this.disposeContent();

        viewport.content.clear();
        viewport.addContent(this.root);

        viewport.contentHeight = 0;
        viewport.setScroll(0, 0);

        const generation = this.generation;

        // Populate progressively.
        void this.populate(generation);
    }


    public async layout(
        width: number,
        height: number
    ): Promise<void> {
        this.width = width;
        this.height = height;

        /*
         * For now the project gets rebuilt on mount.
         *
         * If your virtual viewport size is fixed, that's
         * probably all you need.
         *
         * If width can actually change while mounted,
         * you can later add a relayout pass here.
         */
    }


    public dispose(): void {
        ++this.generation;

        this.disposeContent();

        this.viewport = null;
    }


    // ==================================================
    // Build
    // ==================================================

    private async populate(
        generation: number
    ): Promise<void> {
        try {
            const url = await this.ctx.getAssetUrl(this.markdownPath);
            if (url === null) {
                this.addError(
                    "Project file not found."
                );

                return;
            }

            const response = await fetch(
                url
            );

            if (!response.ok) {
                this.addError(
                    "Project file not found."
                );

                return;
            }

            const markdown =
                await response.text();

            if (!this.isCurrent(generation)) {
                return;
            }

            const tree: Root = fromMarkdown(
                markdown,
                {
                    extensions: [
                        gfm()
                    ],
                }
            );

            let y = 0;

            for (const node of tree.children) {
                if (!this.isCurrent(generation)) {
                    return;
                }

                y = await this.renderBlock(
                    node,
                    y,
                    generation
                );

                this.setContentHeight(y);
            }
        }
        catch (error) {
            console.error(
                "Failed to render project:",
                error
            );

            if (this.isCurrent(generation)) {
                this.addError(
                    "Failed to load project."
                );
            }
        }
    }


    // ==================================================
    // Block rendering
    // ==================================================

    private async renderBlock(
        node: RootContent,
        y: number,
        generation: number
    ): Promise<number> {
        switch (node.type) {
            case "heading":
                return this.renderHeading(
                    node,
                    y
                );

            case "paragraph":
                return this.renderParagraph(
                    node,
                    y,
                    generation
                );

            case "blockquote":
                return this.renderBlockquote(
                    node,
                    y
                );

            case "code":
                return this.renderCode(
                    node,
                    y
                );

            case "list":
                return this.renderList(
                    node,
                    y
                );

            case "thematicBreak":
                return this.renderThematicBreak(
                    y
                );

            default:
                return y;
        }
    }


    // ==================================================
    // Heading
    // ==================================================

    private async renderHeading(
        node: Heading,
        y: number
    ): Promise<number> {
        const sizes: Record<number, number> = {
            1: 32,
            2: 28,
            3: 24,
            4: 20,
            5: 18,
            6: 16,
        };

        const rich =
            this.renderPhrasing(node.children);

        const text = this.createText(
            rich,
            sizes[node.depth] ?? 20
        );

        text.position.set(0, y, 0);

        this.add(text);

        await this.syncText(text);

        return (
            y +
            this.textHeight(text) +
            (node.depth <= 2 ? 20 : 12)
        );
    }


    // ==================================================
    // Paragraph
    // ==================================================

    private async renderParagraph(
        node: Paragraph,
        y: number,
        generation: number
    ): Promise<number> {
        /*
         * Markdown images that are the sole meaningful
         * content of a paragraph behave like block
         * images, like normal HTML Markdown rendering.
         */
        const meaningful =
            node.children.filter(child => {
                return !(
                    child.type === "text" &&
                    child.value.trim() === ""
                );
            });

        if (
            meaningful.length === 1 &&
            meaningful[0].type === "image"
        ) {
            const media = meaningful[0];

            /*
             * Resolve image relative to Markdown file.
             *
             * new URL handles:
             *   ./image.webp
             *   ../assets/image.png
             *   absolute URLs
             */
            let url = new URL(
                media.url,
                new URL(
                    this.markdownPath,
                    window.location.href
                )
            ).pathname.slice(1);

            url = await this.ctx.getAssetUrl(url) ?? "";

            if (/\.mp4(?:[?#].*)?$/i.test(media.url)) {
                return this.renderVideo(
                    url,
                    y,
                    generation
                );
            }

            return this.renderImage(
                url,
                y,
                generation
            );
        }

        const rich =
            this.renderPhrasing(node.children);

        const text = this.createText(
            rich,
            20
        );

        text.position.set(0, y, 0);

        this.add(text);

        await this.syncText(text);

        return (
            y +
            this.textHeight(text) +
            16
        );
    }


    // ==================================================
    // Blockquote
    // ==================================================

    private async renderBlockquote(
        node: Blockquote,
        y: number
    ): Promise<number> {
        const quoteWidth =
            Math.max(0, this.width - 32);

        const textContent =
            node.children
                .filter(
                    child =>
                        child.type === "paragraph"
                )
                .map(child =>
                    this.renderPhrasing(
                        child.children
                    )
                );

        const rich: RichText = {
            text: textContent
                .map(value => value.text)
                .join("\n"),
            styleRanges: {},
        };

        const text = this.createText(
            rich,
            20
        );

        text.maxWidth = quoteWidth;

        text.position.set(
            24,
            y,
            0
        );

        this.add(text);

        // Left HTML-like quote border.
        const border = new THREE.Mesh(
            this.ctx.geometry,
            new THREE.MeshBasicMaterial({
                color: 0x808080,
            })
        );

        border.position.set(
            8,
            y,
            0
        );

        this.add(border);

        await this.syncText(text);

        const h = this.textHeight(text);

        border.scale.set(
            4,
            h,
            1
        );

        return y + h + 20;
    }


    // ==================================================
    // Code
    // ==================================================

    private async renderCode(
        node: Code,
        y: number
    ): Promise<number> {
        const padding = 12;

        const text = this.createText(
            {
                text: node.value,
                styleRanges: {},
            },
            16,
            this.ctx.fonts.serif
        );

        text.maxWidth =
            Math.max(
                0,
                this.width - padding * 2
            );

        text.position.set(
            padding,
            y + padding,
            0
        );

        await this.syncText(text);

        const h =
            this.textHeight(text) +
            padding * 2;

        const background =
            new THREE.Mesh(
                this.ctx.geometry,
                new THREE.MeshBasicMaterial({
                    color: 0xeeeeee,
                })
            );

        background.position.set(
            0,
            y,
            0
        );

        background.scale.set(
            this.width,
            h,
            1
        );

        this.add(background);
        this.add(text);

        return y + h + 20;
    }


    // ==================================================
    // Lists
    // ==================================================

    private async renderList(
        list: List,
        y: number,
        depth = 0
    ): Promise<number> {
        let index = 0;

        for (const item of list.children) {
            y = await this.renderListItem(
                item,
                y,
                depth,
                list.ordered
                    ? `${(list.start ?? 1) + index}.`
                    : "•"
            );

            ++index;
        }

        return y + 8;
    }


    private async renderListItem(
        item: ListItem,
        y: number,
        depth: number,
        marker: string
    ): Promise<number> {
        const indent = depth * 24;

        for (const child of item.children) {
            if (child.type === "paragraph") {
                const rich =
                    this.renderPhrasing(
                        child.children
                    );

                rich.text =
                    `${marker} ${rich.text}`;

                const text =
                    this.createText(
                        rich,
                        20
                    );

                text.position.set(
                    indent,
                    y,
                    0
                );

                text.maxWidth =
                    Math.max(
                        0,
                        this.width - indent
                    );

                this.add(text);

                await this.syncText(text);

                y +=
                    this.textHeight(text) +
                    6;
            }
            else if (child.type === "list") {
                y = await this.renderList(
                    child,
                    y,
                    depth + 1
                );
            }
        }

        return y;
    }


    // ==================================================
    // Thematic break
    // ==================================================

    private renderThematicBreak(
        y: number
    ): number {
        const line = new THREE.Mesh(
            this.ctx.geometry,
            new THREE.MeshBasicMaterial({
                color: 0x808080,
            })
        );

        line.position.set(
            0,
            y + 8,
            0
        );

        line.scale.set(
            this.width,
            1,
            1
        );

        this.add(line);

        return y + 25;
    }


    // ==================================================
    // Image
    // ==================================================

    private async renderVideo(
        url: string,
        y: number,
        generation: number
    ): Promise<number> {
        const video = document.createElement("video");

        video.crossOrigin = "anonymous"
        // video.muted = true;
        video.loop = false;
        video.playsInline = true;
        video.preload = "metadata";
        video.src = url;

        // Wait until dimensions are known.
        await new Promise<void>((resolve, reject) => {
            video.addEventListener(
                "loadedmetadata",
                () => resolve(),
                { once: true }
            );

            video.addEventListener(
                "error",
                () => reject(
                    new Error(`Failed to load video: ${url}`)
                ),
                { once: true }
            );
        });

        if (!this.isCurrent(generation)) {
            video.src = "";
            return y;
        }

        const aspect =
            video.videoHeight /
            video.videoWidth;

        let width = Math.min(
            video.videoWidth,
            this.width
        );

        let height = width * aspect;

        if (height > 0.5 * this.width) {
            height = 0.5 * this.width;
            width = height / aspect;
        }

        const texture = new THREE.VideoTexture(video);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const mesh = new THREE.Mesh(
            this.ctx.geometry,
            new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
            })
        );

        mesh.userData.clickable = true;
        mesh.userData.video = video;
        mesh.position.set(0, y, 0);
        mesh.scale.set(width, height, 1);

        this.add(mesh);

        video.load();

        return y + height + 20;
    }

    private async renderImage(
        url: string,
        y: number,
        generation: number
    ): Promise<number> {
        const texture =
            await this.ctx.textureLoader.loadAsync(
                url
            );

        if (!this.isCurrent(generation)) {
            return y;
        }

        texture.colorSpace =
            THREE.SRGBColorSpace;

        const aspect =
            texture.image.height /
            texture.image.width;

        let imageWidth =
            Math.min(
                texture.image.width,
                this.width
            );

        let imageHeight =
            imageWidth * aspect;

        if (imageHeight > 0.5 * this.width) {
            imageHeight = 0.5 * this.width;
            imageWidth = imageHeight / aspect;
        }

        const image = new THREE.Mesh(
            this.ctx.geometry,
            new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
            })
        );

        image.position.set(
            0,
            y,
            0
        );

        image.scale.set(
            imageWidth,
            imageHeight,
            1
        );

        this.add(image);

        return y + imageHeight + 20;
    }


    // ==================================================
    // Inline Markdown
    // ==================================================

    private renderPhrasing(
        children: readonly PhrasingContent[]
    ): RichText {
        const result: RichText = {
            text: "",
            styleRanges: {},
        };

        for (const child of children) {
            this.appendPhrasing(
                result,
                child
            );
        }

        return result;
    }


    private appendPhrasing(
        result: RichText,
        node: PhrasingContent
    ): void {
        switch (node.type) {
            case "text":
                result.text += node.value;
                break;

            case "break":
                result.text += "\n";
                break;

            case "strong":
                this.appendStyled(
                    result,
                    node.children,
                    {
                        font:
                            this.ctx.fonts.serif,
                    }
                );
                break;

            case "emphasis":
                this.appendStyled(
                    result,
                    node.children,
                    {
                        font:
                            this.ctx.fonts.serif,
                    }
                );
                break;

            case "inlineCode":
                this.appendStyledText(
                    result,
                    node.value,
                    {
                        font:
                            this.ctx.fonts.serif,
                        color: 0x333333,
                    }
                );
                break;

            case "link":
                this.appendStyled(
                    result,
                    node.children,
                    {
                        color: 0x0000ee,
                    }
                );

                /*
                 * Later you can store the character
                 * range + URL here and use Troika's
                 * caret APIs for clickable links.
                 */
                break;

            case "image":
                /*
                 * Inline images are deliberately not
                 * supported here. Block image paragraphs
                 * are handled by renderParagraph().
                 */
                result.text += node.alt ?? "";
                break;

            default:
                break;
        }
    }


    private appendStyled(
        result: RichText,
        children: readonly PhrasingContent[],
        style: TextStyle
    ): void {
        const start =
            result.text.length;

        for (const child of children) {
            this.appendPhrasing(
                result,
                child
            );
        }

        if (result.text.length === start) {
            return;
        }

        result.styleRanges[start] = style;

        result.styleRanges[
            result.text.length
        ] = null;
    }


    private appendStyledText(
        result: RichText,
        value: string,
        style: TextStyle
    ): void {
        const start =
            result.text.length;

        result.styleRanges[start] =
            style;

        result.text += value;

        result.styleRanges[
            result.text.length
        ] = null;
    }


    // ==================================================
    // Text creation
    // ==================================================

    private createText(
        rich: RichText,
        size: number,
        font = this.ctx.fonts.serif
    ): TroikaText {
        const text = new TroikaText();

        text.text = rich.text;

        text.font = font;
        text.fontSize = size;

        text.styleRanges =
            rich.styleRanges;

        text.color = 0x000000;

        text.anchorX = "left";
        text.anchorY = "top";

        text.maxWidth = this.width;

        text.whiteSpace = "normal";
        text.overflowWrap =
            "break-word";

        /*
         * Your UI coordinate system is Y-down.
         */
        text.scale.y = -1;

        return text;
    }


    // ==================================================
    // Helpers
    // ==================================================

    private add(
        object: THREE.Object3D
    ): void {
        this.root.add(object);

        /*
         * The root was already attached before these
         * objects existed, so configure newly added
         * meshes for WindowViewport clipping.
         */
        this.viewport?.configureContent(
            object
        );
    }


    private syncText(
        text: TroikaText
    ): Promise<void> {
        return new Promise(resolve => {
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


    private setContentHeight(
        height: number
    ): void {
        this.contentHeight = height;

        if (this.viewport) {
            this.viewport.contentHeight =
                height;
        }

        // this.ctx.requestLayout();
    }


    private isCurrent(
        generation: number
    ): boolean {
        return (
            generation === this.generation &&
            this.viewport !== null
        );
    }


    private addError(
        message: string
    ): void {
        const text = this.createText(
            {
                text: message,
                styleRanges: {},
            },
            20
        );

        text.position.set(0, 0, 0);

        this.add(text);

        text.sync();
    }


    // ==================================================
    // Cleanup
    // ==================================================

    private disposeContent(): void {
        /*
         * Dispose objects we created for this page.
         *
         * Shared ctx.geometry is NOT disposed.
         * Shared/cached textures are NOT disposed here.
         */

        this.root.traverse(object => {
            if (object instanceof TroikaText) {
                object.dispose();
                return;
            }

            if (object instanceof THREE.Mesh) {
                const video = object.userData.video;

                if (video instanceof HTMLVideoElement) {
                    video.pause();
                    video.removeAttribute("src");
                    video.load();
                    delete object.userData.video;
                }

                const material = object.material;
                if (Array.isArray(material)) {
                    for (const m of material) {
                        m.dispose();
                    }
                }
                else {
                    material.dispose();
                }

                /*
                 * Only dispose geometry if it isn't
                 * the shared application quad.
                 */
                if (
                    object.geometry !==
                    this.ctx.geometry
                ) {
                    object.geometry.dispose();
                }
            }
        });

        this.root.clear();

        this.contentHeight = 0;
    }
}
