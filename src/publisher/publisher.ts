import Konva from 'konva';
import { addObjectSnapping } from './objectSnapping';
import { PCircle, PGroup, PImage, PPath, PRect, PText } from './shapes';
import { type KGroup, type KLayer, type KPath, type KShape } from './types';

export class Publisher {
    stage: Konva.Stage | null;
    transformer = new Konva.Transformer({
        // Performance optimization: Reduce transformer overhead
        anchorSize: 8,
        borderStrokeWidth: 1,
        anchorCornerRadius: 2,
        enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        rotateEnabled: true,
        keepRatio: false,
    });
    defaultLayer = new Konva.Layer();
    selectionRectangle = new Konva.Rect({
        fill: 'rgba(0,0,255,0.5)',
        visible: false,
        listening: false,
    });
    selecting = false;
    x1: number | undefined;
    y1: number | undefined;
    x2: number | undefined;
    y2: number | undefined;

    state: (PCircle | PImage | PRect | PText | PGroup | PPath)[] = [];

    constructor() {
        this.stage = null;
    }
    init(el: HTMLDivElement, { width, height }: { width: number; height: number }) {
        if (el) {
            this.stage?.clear();
            this.stage = new Konva.Stage({
                container: el,
                width: width,
                height: height,
            });
            
            // Performance optimization: Set pixelRatio to 1 for better performance
            // on high DPI displays, or set to window.devicePixelRatio only if needed
            this.stage.setAttr('pixelRatio', 1);
            
            this.stage.add(this.defaultLayer);
            this.defaultLayer.add(this.transformer);
            // this.defaultLayer.add(this.selectionRectangle);

            // this.stage.on('mousedown touchstart', e => {
            //     // do nothing if we mousedown on any shape
            //     if (!this.stage || e.target !== this.stage) {
            //         return;
            //     }
            //     e.evt.preventDefault();
            //     this.x1 = this.stage.getPointerPosition()?.x;
            //     this.y1 = this.stage.getPointerPosition()?.y;
            //     this.x2 = this.stage.getPointerPosition()?.x;
            //     this.y2 = this.stage.getPointerPosition()?.y;

            //     this.selectionRectangle.width(0);
            //     this.selectionRectangle.height(0);
            //     this.selecting = true;
            // });

            // this.stage.on('mousemove touchmove', e => {
            //     // do nothing if we didn't start selection
            //     if (!this.selecting || !this.stage) {
            //         return;
            //     }
            //     e.evt.preventDefault();
            //     this.x2 = this.stage.getPointerPosition()?.x;
            //     this.y2 = this.stage.getPointerPosition()?.y;

            //     this.selectionRectangle.setAttrs({
            //         visible: true,
            //         x: Math.min(this.x1 ?? 0, this.x2 ?? 0),
            //         y: Math.min(this.y1 ?? 0, this.y2 ?? 0),
            //         width: Math.abs((this.x2 ?? 0) - (this.x1 ?? 0)),
            //         height: Math.abs((this.y2 ?? 0) - (this.y1 ?? 0)),
            //     });
            // });
            // this.stage.on('mouseup touchend', e => {
            //     // do nothing if we didn't start selection
            //     this.selecting = false;
            //     if (!this.selectionRectangle.visible() || !this.stage) {
            //         return;
            //     }
            //     e.evt.preventDefault();
            //     // update visibility in timeout, so we can check it in click event
            //     this.selectionRectangle.visible(false);
            //     const shapes = this.stage.find('.object');
            //     const box = this.selectionRectangle.getClientRect();
            //     const selected = shapes.filter(shape => Konva.Util.haveIntersection(box, shape.getClientRect()));
            //     this.transformer.nodes(selected);
            // });

            // clicks should select/deselect shapes
            this.stage.on('click tap', e => {
                // if we are selecting with rect, do nothing
                // if (this.selectionRectangle.visible()) {
                //     return;
                // }

                // if click on empty area - remove all selections
                if (e.target === this.stage) {
                    this.transformer.nodes([]);
                    return;
                }

                // do nothing if clicked NOT on our rectangles
                // if (!e.target.hasName('rect')) {
                //     return;
                // }

                // do we pressed shift or ctrl?
                const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
                const isSelected = this.transformer.nodes().indexOf(e.target) >= 0;

                if (!metaPressed && !isSelected) {
                    // if no key pressed and the node is not selected
                    // select just one
                    this.transformer.nodes([e.target]);
                } else if (metaPressed && isSelected) {
                    // if we pressed keys and node was selected
                    // we need to remove it from selection:
                    const nodes = this.transformer.nodes().slice(); // use slice to have new copy of array
                    // remove node from array
                    nodes.splice(nodes.indexOf(e.target), 1);
                    this.transformer.nodes(nodes);
                } else if (metaPressed && !isSelected) {
                    // add the node into selection
                    const nodes = this.transformer.nodes().concat([e.target]);
                    this.transformer.nodes(nodes);
                }

                // create event to listen to in the parent component
                const selected = this.transformer.nodes();
                const event = new CustomEvent('k-selected', {
                    detail: selected,
                });
                window.dispatchEvent(event);
            });

            addObjectSnapping(this);
        }
    }
    getSelected() {
        return this.transformer.nodes();
    }

    clearAll() {
        this.stage?.clear();
        this.defaultLayer.children.forEach(child => {
            if (child.className !== 'Transformer') {
                child.destroy();
            }
        });
        // this.defaultLayer.add(this.transformer);
        // this.defaultLayer.add(this.selectionRectangle);
        this.stage?.add(this.defaultLayer);
        this.state = [];
    }
    addShape(shape: PCircle | PImage | PRect | PText | PGroup | PPath) {
        this.defaultLayer.add(shape.shape);
        this.state.push(shape);
        this.transformer.moveToTop();
        // Note: batchDraw is called in loadState to batch all additions
    }
    addRect(props: Konva.RectConfig & { placeholders?: { fill?: string } }) {
        this.addShape(new PRect(props));
    }
    addCircle(props: Konva.CircleConfig & { placeholders?: { fill?: string } }) {
        this.addShape(new PCircle(props));
    }
    addPath(props: KPath & { placeholders?: { fill?: string } }) {
        this.addShape(new PPath(props));
    }
    addText(props: Konva.TextConfig & { placeholders?: { text?: string } }) {
        this.addShape(new PText(props));
    }
    addImage(url: string, props: Omit<Konva.ImageConfig, 'image'> & { placeholders?: { image?: string } }) {
        this.addShape(new PImage(url, props));
    }
    addGroup(props: KGroup) {
        this.addShape(new PGroup(props));
    }

    renderShape(shape: KGroup | KShape) {
        switch (shape.type) {
            case 'rect':
                this.addRect(shape);
                break;
            case 'circle':
                this.addCircle(shape);
                break;
            case 'text':
                this.addText(shape);
                break;
            case 'image':
                this.addImage(shape.url, shape);
                break;
            case 'group':
                this.addGroup(shape);
                break;
            case 'path':
                this.addPath(shape);
                break;
        }
    }

    getState() {
        const obj: KLayer = { type: 'layer', children: [] };
        this.state.map(shape => obj.children.push(shape.getState()));
        return obj;
    }

    loadState(state: KLayer) {
        // Performance optimization: Batch all shape additions
        state.children.forEach(shape => this.renderShape(shape));
        this.defaultLayer.batchDraw();
    }
}
