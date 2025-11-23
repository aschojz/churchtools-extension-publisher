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
export interface KPath extends KBaseShape, Konva.PathConfig {
    type: 'path';
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
export type KShape = KRect | KText | KCircle | KImage | KPath;

export interface KGroup extends Konva.GroupConfig {
    type: 'group';
    children: (KShape | KGroup)[];
}
