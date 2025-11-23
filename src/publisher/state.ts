import Konva from 'konva';

export interface KLayer {
    type: 'layer';
    defaultVariables?: Record<string, string>;
    children: (KShape | KGroup)[];
    width: number;
    height: number;
}
interface KBaseShape {
    x?: number;
    y?: number;
}
export interface KRect extends KBaseShape, Konva.RectConfig {
    type: 'rect';
}
export interface KCircle extends KBaseShape, Konva.CircleConfig {
    type: 'circle';
}
export interface KText extends KBaseShape, Konva.TextConfig {
    type: 'text';
    text: string;
}
export interface KImage extends KBaseShape, Omit<Konva.ImageConfig, 'image'> {
    type: 'image';
    url: string;
}
export type KShape = KRect | KText | KCircle | KImage;

export interface KGroup extends Konva.GroupConfig {
    type: 'group';
    children: (KShape | KGroup)[];
}

export const state: KLayer[] = [
    {
        type: 'layer',
        children: [
            { type: 'rect', x: 60, y: 60, width: 100, height: 90, fill: 'red' },
            {
                type: 'rect',
                x: 250,
                y: 100,
                width: 150,
                height: 90,
                fill: 'green',
            },
        ],
        width: 700,
        height: 1080,
    },
];
