import { storeToRefs } from 'pinia';
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    type ComponentPublicInstance,
} from 'vue';

import type { LayoutFrame } from '../domain/layoutEditing';
import { usePublisherEditorStore } from '../stores/publisherEditor';

export const PUBLISHER_PREVIEW_BASE_SCALE = 0.32;
export const PUBLISHER_ZOOM_MIN = 25;
export const PUBLISHER_ZOOM_MAX = 400;

export const constrainPublisherZoom = (zoom: number) =>
    Math.min(PUBLISHER_ZOOM_MAX, Math.max(PUBLISHER_ZOOM_MIN, zoom));

export const calculateFittedPublisherZoom = (
    viewport: { width: number; height: number },
    content: { width: number; height: number },
    margin = 96,
) => {
    const availableWidth = Math.max(1, viewport.width - margin);
    const availableHeight = Math.max(1, viewport.height - margin);
    const contentWidth = Math.max(1, content.width) * PUBLISHER_PREVIEW_BASE_SCALE;
    const contentHeight = Math.max(1, content.height) * PUBLISHER_PREVIEW_BASE_SCALE;
    return constrainPublisherZoom(Math.min(availableWidth / contentWidth, availableHeight / contentHeight) * 100);
};

const editableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest(
        'a[href], button, input, select, textarea, [contenteditable="true"], [role="button"], [role="slider"]',
    ));
};

export const usePublisherWorkspaceZoom = () => {
    const editorStore = usePublisherEditorStore();
    const { panToolEnabled, previewZoomPercent } = storeToRefs(editorStore);
    const workspaceZoomScale = computed(() => (previewZoomPercent.value / 100) * PUBLISHER_PREVIEW_BASE_SCALE);
    const workspaceRef = ref<HTMLElement | null>(null);
    const temporaryPanEnabled = ref(false);
    const isPanning = ref(false);
    const panReady = computed(() => panToolEnabled.value || temporaryPanEnabled.value);
    const setWorkspaceElement = (element: Element | ComponentPublicInstance | null) => {
        workspaceRef.value = element instanceof HTMLElement ? element : null;
    };
    let animationFrame: number | null = null;
    let pendingZoom: { value: number; clientX: number; clientY: number } | null = null;
    let activePan: {
        pointerId: number;
        clientX: number;
        clientY: number;
        scrollLeft: number;
        scrollTop: number;
    } | null = null;

    const handleWorkspaceWheel = (event: WheelEvent, enabled: boolean) => {
        if ((!event.ctrlKey && !event.metaKey) || !enabled || !workspaceRef.value) return;
        event.preventDefault();
        const workspace = workspaceRef.value;
        const deltaPixels = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? 16
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? workspace.clientHeight : 1);
        const previousTarget = pendingZoom?.value ?? previewZoomPercent.value;
        const nextZoom = Math.round(constrainPublisherZoom(previousTarget * Math.exp(-deltaPixels * 0.004)) * 100) / 100;
        pendingZoom = { value: nextZoom, clientX: event.clientX, clientY: event.clientY };
        if (animationFrame !== null) return;
        animationFrame = requestAnimationFrame(() => {
            animationFrame = null;
            const pending = pendingZoom;
            pendingZoom = null;
            if (!pending || !workspaceRef.value) return;
            const currentWorkspace = workspaceRef.value;
            const previousZoom = previewZoomPercent.value;
            const bounds = currentWorkspace.getBoundingClientRect();
            const pointerX = pending.clientX - bounds.left;
            const pointerY = pending.clientY - bounds.top;
            const contentX = currentWorkspace.scrollLeft + pointerX;
            const contentY = currentWorkspace.scrollTop + pointerY;
            previewZoomPercent.value = pending.value;
            void nextTick(() => {
                const ratio = pending.value / previousZoom;
                currentWorkspace.scrollLeft = contentX * ratio - pointerX;
                currentWorkspace.scrollTop = contentY * ratio - pointerY;
            });
        });
    };

    const finishWorkspacePan = (event?: PointerEvent) => {
        if (event && activePan?.pointerId !== event.pointerId) return;
        const workspace = workspaceRef.value;
        if (workspace && activePan && workspace.hasPointerCapture(activePan.pointerId)) {
            workspace.releasePointerCapture(activePan.pointerId);
        }
        activePan = null;
        isPanning.value = false;
    };

    const handleWorkspacePointerDown = (event: PointerEvent, enabled: boolean) => {
        const workspace = workspaceRef.value;
        if (!enabled || !workspace || !panReady.value || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        activePan = {
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
            scrollLeft: workspace.scrollLeft,
            scrollTop: workspace.scrollTop,
        };
        workspace.setPointerCapture(event.pointerId);
        isPanning.value = true;
    };

    const handleWorkspacePointerMove = (event: PointerEvent) => {
        const workspace = workspaceRef.value;
        if (!workspace || !activePan || activePan.pointerId !== event.pointerId) return;
        event.preventDefault();
        workspace.scrollLeft = activePan.scrollLeft - (event.clientX - activePan.clientX);
        workspace.scrollTop = activePan.scrollTop - (event.clientY - activePan.clientY);
    };

    const centerDocumentPoint = async (
        pageId: string,
        point: { x: number; y: number },
        documentSize: { width: number; height: number },
    ) => {
        await nextTick();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const workspace = workspaceRef.value;
        const artboard = [...(workspace?.querySelectorAll<HTMLElement>('.publisher-artboard') ?? [])]
            .find((element) => element.dataset.pageId === pageId);
        const stage = artboard?.querySelector<HTMLElement>('.konvajs-content');
        if (!workspace || !stage) return;
        const workspaceBounds = workspace.getBoundingClientRect();
        const stageBounds = stage.getBoundingClientRect();
        const targetX = stageBounds.left - workspaceBounds.left
            + point.x * (stageBounds.width / Math.max(1, documentSize.width));
        const targetY = stageBounds.top - workspaceBounds.top
            + point.y * (stageBounds.height / Math.max(1, documentSize.height));
        workspace.scrollLeft += targetX - workspace.clientWidth / 2;
        workspace.scrollTop += targetY - workspace.clientHeight / 2;
    };

    const applyZoomAndCenter = async (
        zoom: number,
        pageId: string,
        point: { x: number; y: number },
        documentSize: { width: number; height: number },
    ) => {
        previewZoomPercent.value = constrainPublisherZoom(zoom);
        await centerDocumentPoint(pageId, point, documentSize);
    };

    const fitWorkspacePage = async (pageId: string, documentSize: { width: number; height: number }) => {
        const workspace = workspaceRef.value;
        if (!workspace) return;
        const zoom = calculateFittedPublisherZoom(
            { width: workspace.clientWidth, height: workspace.clientHeight },
            documentSize,
        );
        await applyZoomAndCenter(zoom, pageId, {
            x: documentSize.width / 2,
            y: documentSize.height / 2,
        }, documentSize);
    };

    const fitWorkspaceSelection = async (
        pageId: string,
        selection: LayoutFrame,
        documentSize: { width: number; height: number },
    ) => {
        const workspace = workspaceRef.value;
        if (!workspace) return;
        const zoom = calculateFittedPublisherZoom(
            { width: workspace.clientWidth, height: workspace.clientHeight },
            selection,
            128,
        );
        await applyZoomAndCenter(zoom, pageId, {
            x: selection.x + selection.width / 2,
            y: selection.y + selection.height / 2,
        }, documentSize);
    };

    const showActualSize = async (
        pageId: string,
        documentSize: { width: number; height: number },
        selection?: LayoutFrame | null,
    ) => {
        const point = selection
            ? { x: selection.x + selection.width / 2, y: selection.y + selection.height / 2 }
            : { x: documentSize.width / 2, y: documentSize.height / 2 };
        await applyZoomAndCenter(100, pageId, point, documentSize);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.code !== 'Space' || event.repeat || editableTarget(event.target)) return;
        event.preventDefault();
        temporaryPanEnabled.value = true;
    };
    const handleKeyUp = (event: KeyboardEvent) => {
        if (event.code !== 'Space') return;
        temporaryPanEnabled.value = false;
        finishWorkspacePan();
    };
    const resetTemporaryPan = () => {
        temporaryPanEnabled.value = false;
        finishWorkspacePan();
    };

    onMounted(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', resetTemporaryPan);
    });

    onBeforeUnmount(() => {
        if (animationFrame !== null) cancelAnimationFrame(animationFrame);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('blur', resetTemporaryPan);
    });

    return {
        fitWorkspacePage,
        fitWorkspaceSelection,
        handleWorkspacePointerDown,
        handleWorkspacePointerMove,
        handleWorkspaceWheel,
        isPanning,
        panReady,
        previewZoomPercent,
        setWorkspaceElement,
        showActualSize,
        stopWorkspacePan: finishWorkspacePan,
        workspaceZoomScale,
    };
};
