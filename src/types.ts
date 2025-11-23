export interface PublisherPage {
    id: string;
    sortKey: number;
    label: string;
    width: number;
    height: number;
    layers?: Record<string, PageLayer>;
}

interface LayerConfig {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
}

interface PageLayerImage {
    type: 'image';
    label?: string;
    children?: Record<string, PageLayer>;
    config: LayerConfig & {
        image: string;
    };
}
interface PageLayerText {
    type: 'text';
    label?: string;
    children?: Record<string, PageLayer>;
    config: LayerConfig & {
        fill?: string;
        align?: 'left' | 'center' | 'right';
        verticalAlign?: 'top' | 'middle' | 'bottom';
        fontStyle?: 'normal' | 'italic' | 'bold';
        fontFamily?: string;
        fontSize?: number;
        text?: string;
        lineHeight?: number;
    };
}
interface PageLayerRect {
    type: 'rect';
    label?: string;
    children?: Record<string, PageLayer>;
    config: LayerConfig & {
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
    };
}
interface PageLayerGroup {
    type: 'group';
    label?: string;
    children?: Record<string, PageLayer>;
    config: LayerConfig;
}
interface PageLayerCircle {
    type: 'circle';
    label?: string;
    children?: Record<string, PageLayer>;
    config: LayerConfig & {
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
        shadowColor?: string;
        shadowBlur?: number;
        shadowOffset?: {
            x: number;
            y: number;
        };
    };
}

export type PageLayer = PageLayerImage | PageLayerText | PageLayerRect | PageLayerGroup | PageLayerCircle;
