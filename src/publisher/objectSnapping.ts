import Konva from 'konva';
import { Publisher } from './publisher';

type Snap = 'start' | 'center' | 'end';

type GuideLine = {
    lineGuide: number;
    offset: number;
    orientation: 'H' | 'V';
    snap: Snap;
};

type ResultLine = {
    lineGuide: GuideLine['lineGuide'];
    diff: number;
    snap: Snap;
    offset: number;
};

const GUIDELINE_OFFSET = 10;

// were can we snap our objects?
function getLineGuideStops(skipShape: Konva.KonvaEventObject<'dragmove'>['target'], stage: Konva.Stage) {
    // we can snap to stage borders and the center of the stage
    const vertical = [0, stage.width() / 2, stage.width()];
    const horizontal = [0, stage.height() / 2, stage.height()];

    // and we snap over edges and center of each object on the canvas
    stage.find('.object').forEach(guideItem => {
        if (guideItem === skipShape) {
            return;
        }
        const box = guideItem.getClientRect();
        // and we can snap to all edges of shapes
        vertical.push([box.x, box.x + box.width, box.x + box.width / 2]);
        horizontal.push([box.y, box.y + box.height, box.y + box.height / 2]);
    });
    return {
        vertical: vertical.flat(),
        horizontal: horizontal.flat(),
    };
}

// what points of the object will trigger to snapping?
// it can be just center of the object
// but we will enable all edges and center
function getObjectSnappingEdges(node: Konva.KonvaEventObject<'dragmove'>['target']) {
    const box = node.getClientRect();
    const absPos = node.absolutePosition();

    return {
        vertical: [
            {
                guide: Math.round(box.x),
                offset: Math.round(absPos.x - box.x),
                snap: 'start' as const,
            },
            {
                guide: Math.round(box.x + box.width / 2),
                offset: Math.round(absPos.x - box.x - box.width / 2),
                snap: 'center' as const,
            },
            {
                guide: Math.round(box.x + box.width),
                offset: Math.round(absPos.x - box.x - box.width),
                snap: 'end' as const,
            },
        ],
        horizontal: [
            {
                guide: Math.round(box.y),
                offset: Math.round(absPos.y - box.y),
                snap: 'start' as const,
            },
            {
                guide: Math.round(box.y + box.height / 2),
                offset: Math.round(absPos.y - box.y - box.height / 2),
                snap: 'center' as const,
            },
            {
                guide: Math.round(box.y + box.height),
                offset: Math.round(absPos.y - box.y - box.height),
                snap: 'end' as const,
            },
        ],
    };
}

// find all snapping possibilities
const getGuides = (
    lineGuideStops: ReturnType<typeof getLineGuideStops>,
    itemBounds: ReturnType<typeof getObjectSnappingEdges>,
) => {
    const resultV: ResultLine[] = [];
    const resultH: ResultLine[] = [];

    lineGuideStops.vertical.forEach(lineGuide => {
        itemBounds.vertical.forEach(itemBound => {
            const diff = Math.abs(lineGuide - itemBound.guide);
            // if the distance between guild line and object snap point is close we can consider this for snapping
            if (diff < GUIDELINE_OFFSET) {
                resultV.push({
                    lineGuide: lineGuide,
                    diff: diff,
                    snap: itemBound.snap,
                    offset: itemBound.offset,
                });
            }
        });
    });
    lineGuideStops.horizontal.forEach(lineGuide => {
        itemBounds.horizontal.forEach(itemBound => {
            const diff = Math.abs(lineGuide - itemBound.guide);
            if (diff < GUIDELINE_OFFSET) {
                resultH.push({
                    lineGuide: lineGuide,
                    diff: diff,
                    snap: itemBound.snap,
                    offset: itemBound.offset,
                });
            }
        });
    });

    const guides: GuideLine[] = [];

    // find closest snap
    const minV = resultV.sort((a, b) => a.diff - b.diff)[0];
    const minH = resultH.sort((a, b) => a.diff - b.diff)[0];
    if (minV) {
        guides.push({
            lineGuide: minV.lineGuide,
            offset: minV.offset,
            orientation: 'V',
            snap: minV.snap,
        });
    }
    if (minH) {
        guides.push({
            lineGuide: minH.lineGuide,
            offset: minH.offset,
            orientation: 'H',
            snap: minH.snap,
        });
    }
    return guides;
};

const drawGuides = (guides: GuideLine[], layer: Publisher['defaultLayer']) => {
    guides.forEach(lg => {
        if (lg.orientation === 'H') {
            const line = new Konva.Line({
                points: [-6000, 0, 6000, 0],
                stroke: 'rgb(0, 161, 255)',
                strokeWidth: 1,
                name: 'guid-line',
                dash: [4, 6],
                listening: false, // Performance: Guide lines don't need event listening
            });
            layer.add(line);
            line.absolutePosition({
                x: 0,
                y: lg.lineGuide,
            });
        } else if (lg.orientation === 'V') {
            const line = new Konva.Line({
                points: [0, -6000, 0, 6000],
                stroke: 'rgb(0, 161, 255)',
                strokeWidth: 1,
                name: 'guid-line',
                dash: [4, 6],
                listening: false, // Performance: Guide lines don't need event listening
            });
            layer.add(line);
            line.absolutePosition({
                x: lg.lineGuide,
                y: 0,
            });
        }
    });
};

export function addObjectSnapping(t: Publisher) {
    let rafId: number | null = null;
    
    t.defaultLayer.on('dragmove', e => {
        // Performance optimization: Use requestAnimationFrame to throttle dragmove events
        if (rafId) {
            return;
        }
        
        rafId = requestAnimationFrame(() => {
            rafId = null;
            
            // clear all previous lines on the screen
            t.defaultLayer.find('.guid-line').forEach(l => l.destroy());

            // find possible snapping lines
            const lineGuideStops = getLineGuideStops(e.target, t.stage);
            // find snapping points of current object
            const itemBounds = getObjectSnappingEdges(e.target);

            // now find where can we snap current object
            const guides = getGuides(lineGuideStops, itemBounds);

            // do nothing of no snapping
            if (!guides.length) {
                return;
            }

            drawGuides(guides, t.defaultLayer);

            const absPos = e.target.absolutePosition();
            // now force object position
            guides.forEach(lg => {
                switch (lg.orientation) {
                    case 'V': {
                        absPos.x = lg.lineGuide + lg.offset;
                        break;
                    }
                    case 'H': {
                        absPos.y = lg.lineGuide + lg.offset;
                        break;
                    }
                }
            });
            e.target.absolutePosition(absPos);
        });
    });
    
    // Performance optimization: Use batchDraw on dragend to ensure clean state
    t.defaultLayer.on('dragend', () => {
        // Cancel any pending animation frame
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        t.defaultLayer.find('.guid-line').forEach(l => l.destroy());
        t.defaultLayer.batchDraw();
    });
}
