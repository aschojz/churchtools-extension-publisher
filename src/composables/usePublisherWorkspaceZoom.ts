import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, ref, type ComponentPublicInstance } from 'vue';

import { usePublisherEditorStore } from '../stores/publisherEditor';

export const usePublisherWorkspaceZoom = () => {
    const { previewZoomPercent } = storeToRefs(usePublisherEditorStore());
    const workspaceZoomScale = computed(() => (previewZoomPercent.value / 100) * 0.32);
    const workspaceRef = ref<HTMLElement | null>(null);
    const setWorkspaceElement = (element: Element | ComponentPublicInstance | null) => {
        workspaceRef.value = element instanceof HTMLElement ? element : null;
    };
    let animationFrame: number | null = null;
    let pendingZoom: { value: number; clientX: number; clientY: number } | null = null;

    const handleWorkspaceWheel = (event: WheelEvent, enabled: boolean) => {
        if ((!event.ctrlKey && !event.metaKey) || !enabled || !workspaceRef.value) return;
        event.preventDefault();
        const workspace = workspaceRef.value;
        const deltaPixels = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? 16
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? workspace.clientHeight : 1);
        const previousTarget = pendingZoom?.value ?? previewZoomPercent.value;
        const nextZoom = Math.round(Math.min(400, Math.max(25, previousTarget * Math.exp(-deltaPixels * 0.004))) * 100) / 100;
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

    onBeforeUnmount(() => {
        if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    });

    return {
        handleWorkspaceWheel,
        previewZoomPercent,
        setWorkspaceElement,
        workspaceZoomScale,
    };
};
