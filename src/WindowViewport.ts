/**
 * \file window.ts
 * \brief 
 *
 * \author Stanley Arnaud
 * \date 2026-11-10
 */

import * as THREE from 'three';

export interface WindowViewportOptions {
    geometry: THREE.BufferGeometry;
    x?: number;
    y?: number;
    width?: number;
    height?: number;

    stencilRef?: number;
    renderOrder?: number;
}

export class WindowViewport extends THREE.Group {
    public readonly mask: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

    public readonly content: THREE.Group;
    public contentHeight: number = 0;

    private viewportX: number;
    private viewportY: number;
    private viewportWidth: number;
    private viewportHeight: number;

    get width() { return this.viewportWidth; }
    get height() { return this.viewportHeight; }

    private scrollX = 0;
    private scrollY = 0;

    public readonly stencilRef: number;
    public readonly contentRenderOrder: number;

    constructor({
        geometry,
        x = 0,
        y = 0,
        width = 1,
        height = 1,
        stencilRef = 1,
        renderOrder = 0,
    }: WindowViewportOptions) {
        super();

        this.viewportX = x;
        this.viewportY = y;
        this.viewportWidth = width;
        this.viewportHeight = height;

        this.stencilRef = stencilRef;
        this.contentRenderOrder = renderOrder + 1;

        // Mask
        const maskMaterial = new THREE.MeshBasicMaterial({
            colorWrite: false,
            depthWrite: false,
            depthTest: false,

            stencilWrite: true,
            stencilRef,
            stencilFunc: THREE.AlwaysStencilFunc,

            stencilFail: THREE.KeepStencilOp,
            stencilZFail: THREE.KeepStencilOp,
            stencilZPass: THREE.ReplaceStencilOp,
        });

        this.mask = new THREE.Mesh(
            geometry,
            maskMaterial
        );

        this.mask.renderOrder = renderOrder;

        this.add(this.mask);

        // Content
        this.content = new THREE.Group();
        this.add(this.content);

        // Apply initial dimensions
        this.updateTransform();
    }

    public setSize(
        width: number,
        height: number
    ): void {
        this.viewportWidth = width;
        this.viewportHeight = height;

        this.updateTransform();
    }

    public setPosition(
        x: number,
        y: number
    ): void {
        this.viewportX = x;
        this.viewportY = y;

        this.updateTransform();
    }

    public setScroll(
        x: number,
        y: number
    ): void {
        this.scrollX = x;
        this.scrollY = y;

        this.updateTransform();
    }

    private updateTransform(): void {
        // Mask uses scene coordinates
        this.mask.position.set(
            this.viewportX,
            this.viewportY,
            0
        );

        this.mask.scale.set(
            this.viewportWidth,
            this.viewportHeight,
            1
        );

        // Content uses normalized viewport coordinates:
        //
        // (0,0) -------- (1,0)
        //   |              |
        //   |              |
        // (0,1) -------- (1,1)

        this.content.position.set(
            this.viewportX -
            this.scrollX,

            this.viewportY -
            this.scrollY,

            0
        );

        // this.content.scale.set(
        //     this.viewportWidth,
        //     this.viewportHeight,
        //     1
        // );
    }

    /**
     * Adds an Object3D to the clipped content region.
     *
     * Any materials encountered below the object are
     * cloned and configured to test against this
     * viewport's stencil value.
     */
    public addContent<T extends THREE.Object3D>(
        object: T
    ): T {
        this.configureContent(object);
        this.content.add(object);

        return object;
    }

    public configureContent(
        object: THREE.Object3D
    ): void {
        object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                this.configureMesh(child);
            }
        });
    }

    private configureMesh(mesh: THREE.Mesh): void {
        if (Array.isArray(mesh.material)) {
            for (const material of mesh.material) {
                this.configureMaterial(material);
            }
        } else {
            this.configureMaterial(mesh.material);
        }

        mesh.renderOrder = this.contentRenderOrder;
    }

    private configureMaterial(
        material: THREE.Material
    ): void {
        material.depthTest = true;
        material.depthWrite = true;

        material.stencilWrite = true;
        material.stencilRef = this.stencilRef;
        material.stencilFunc = THREE.EqualStencilFunc;
        material.stencilFail = THREE.KeepStencilOp;
        material.stencilZFail = THREE.KeepStencilOp;
        material.stencilZPass = THREE.KeepStencilOp;
    }

    /**
     * Dispose resources owned by this viewport.
     *
     * This only disposes the mask resources.
     * Content resources should be managed separately.
     */
    public dispose(): void {
        this.mask.geometry.dispose();
        this.mask.material.dispose();
    }
}
