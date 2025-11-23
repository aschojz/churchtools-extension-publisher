import Konva from 'konva';
import { type KCircle, type KGroup, type KImage, type KRect, type KShape, type KText } from './state';
export type PlaceholderType = { value: string; placeholder: string } | string;

export abstract class PShape<S extends Konva.Shape | Konva.Group> {
    private _shape: S;
    private _placeholders: Record<string, string> | undefined;
    private _children: (PCircle | PImage | PRect | PText | PGroup)[] = [];
    constructor() {
        this._shape = {} as S;
        this._placeholders = {};
    }
    get shape() {
        return this._shape;
    }
    set shape(shape: S) {
        this._shape = shape;
    }
    get placeholders() {
        return this._placeholders;
    }
    set placeholders(placeholders: Record<string, string> | undefined) {
        this._placeholders = placeholders;
    }
    get children() {
        return this._children;
    }
    set children(children: (PCircle | PImage | PRect | PText | PGroup)[]) {
        this._children = children;
    }

    abstract getState(): Partial<KShape | KGroup>;
}

export class PRect extends PShape<Konva.Rect> {
    constructor(props: Konva.RectConfig & { placeholders?: { fill?: string } }) {
        super();

        this.shape = new Konva.Rect({
            type: 'rect',
            draggable: true,
            ...props,
            x: props.x,
            y: props.y,
            width: props.width,
            height: props.height,
        });
        this.placeholders = props.placeholders;
    }

    getState(): KRect {
        return {
            type: 'rect',
            x: this.shape.x(),
            y: this.shape.y(),
            width: this.shape.width(),
            height: this.shape.height(),
            fill: this.shape.fill(),
            placeholders: this.placeholders,
        };
    }
}

export class PCircle extends PShape<Konva.Circle> {
    constructor(props: Omit<Konva.CircleConfig, 'fill'> & { placeholders?: { fill?: string } }) {
        super();

        this.shape = new Konva.Circle({
            name: 'circle',
            draggable: true,
            ...props,
            x: props.x,
            y: props.y,
            radius: props.radius,
        });
        this.placeholders = props.placeholders;
    }

    getState(): KCircle {
        return {
            type: 'circle',
            x: this.shape.x(),
            y: this.shape.y(),
            radius: this.shape.radius(),
            fill: this.shape.fill(),
            placeholders: this.placeholders,
        };
    }
}

export class PText extends PShape<Konva.Text> {
    constructor(props: Konva.TextConfig & { placeholders?: { text?: string } }) {
        super();
        let text = props.text ?? '';
        if (props.upperCase) {
            text = text.toUpperCase();
        }
        this.shape = new Konva.Text({
            fill: 'black',
            name: 'text',
            draggable: true,
            ...props,
            text,
            fontSize: props.fontSize,
            x: props.x,
            y: props.y,
            width: props.width ? props.width : undefined,
            height: props.height ? props.height : undefined,
        });
        this.placeholders = props.placeholders;
    }

    getState(): KText {
        return {
            type: 'text',
            x: this.shape.x(),
            y: this.shape.y(),
            text: this.shape.text(),
            fill: this.shape.fill(),
            fontSize: this.shape.fontSize(),
            placeholders: this.placeholders,
        };
    }
}

export class PImage extends PShape<Konva.Image> {
    loaded = false;
    constructor(url: PlaceholderType, props: Omit<Konva.ImageConfig, 'image'>) {
        super();
        this.shape = new Konva.Image({
            image: undefined,
            name: 'image',
            draggable: true,
            ...props,
            x: props.x,
            y: props.y,
            width: props.width,
            height: props.height,
        });
        this.placeholders = props.placeholders;

        const image = new Image();
        image.onload = () => {
            this.shape.image(image);
            this.loaded = true;
        };
        image.src = typeof url === 'string' ? url : url.value;
    }
    getState(): KImage {
        return {
            type: 'image',
            x: this.shape.x(),
            y: this.shape.y(),
            width: this.shape.width(),
            height: this.shape.height(),
            url: this.shape.image() ? (this.shape.image() as HTMLImageElement).src : '',
            placeholders: this.placeholders,
        };
    }
}

export class PGroup extends PShape<Konva.Group> {
    constructor(props: KGroup) {
        super();
        this.shape = new Konva.Group({
            draggable: true,
            ...props,
            type: 'group',
            x: props.x ?? 0,
            y: props.y ?? 0,
        });
        props.children.forEach(child => this.renderShape(child));
    }
    getState(): KGroup {
        return {
            type: 'group',
            x: this.shape.x(),
            y: this.shape.y(),
            children: this.children.map(child => child.getState()) ?? [],
        };
    }

    addShape(shape: PCircle | PImage | PRect | PText | PGroup) {
        this.children.push(shape);
        this.shape.add(shape.shape);
    }
    addRect(props: Konva.RectConfig & { placeholders?: { fill?: string } }) {
        this.addShape(new PRect(props));
    }
    addCircle(props: KCircle & { placeholders?: { fill?: string } }) {
        this.addShape(new PCircle(props));
    }
    addText(props: KText & { placeholders?: { text?: string } }) {
        this.addShape(new PText(props));
    }
    addImage(url: string, props: Omit<Konva.ImageConfig, 'image'>) {
        this.addShape(new PImage(url, props));
    }
    addGroup(props: KGroup) {
        const group = new PGroup(props);
        props.children.forEach(child => this.renderShape(child));
        this.shape.add(group.shape);
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
        }
    }
}
