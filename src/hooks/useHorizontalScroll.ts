import React, { useRef, useCallback, useState, useEffect } from 'react';

interface UseHorizontalScrollOptions {
  step?: number;
}

export function useHorizontalScroll(options: UseHorizontalScrollOptions = {}) {
  const { step = 320 } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Drag physics tracking
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const checkScrollability = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    checkScrollability();
    el.addEventListener('scroll', checkScrollability, { passive: true });
    window.addEventListener('resize', checkScrollability);

    const observer = new ResizeObserver(() => {
      checkScrollability();
    });
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
      observer.disconnect();
    };
  }, [checkScrollability]);

  const scrollLeft = useCallback((amount: number = step) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: -amount, behavior: 'smooth' });
  }, [step]);

  const scrollRight = useCallback((amount: number = step) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  }, [step]);

  // Horizontal wheel translation (scrolling mouse wheel over horizontal container)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;

    // If already horizontal scroll (trackpad), let native behavior run
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      return;
    }

    if (e.deltaY !== 0) {
      // Check if container can scroll horizontally
      if (el.scrollWidth > el.clientWidth) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
        checkScrollability();
      }
    }
  }, [checkScrollability]);

  // Mouse drag-to-scroll
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el || e.button !== 0) return; // Only primary mouse button

    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftStartRef.current = el.scrollLeft;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const el = containerRef.current;
    if (!el) return;

    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.4; // Scroll multiplier
    if (Math.abs(walk) > 5) {
      hasDraggedRef.current = true;
    }
    el.scrollLeft = scrollLeftStartRef.current - walk;
    checkScrollability();
  }, [checkScrollability]);

  const handleMouseUpOrLeave = useCallback(() => {
    isDraggingRef.current = false;
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 50);
  }, []);

  // Suppress clicks if a drag operation just occurred
  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  // Keyboard navigation support for TV remote / arrow keys
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollLeft();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollRight();
    }
  }, [scrollLeft, scrollRight]);

  return {
    containerRef,
    canScrollLeft,
    canScrollRight,
    scrollLeft,
    scrollRight,
    checkScrollability,
    scrollHandlers: {
      onWheel: handleWheel,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUpOrLeave,
      onMouseLeave: handleMouseUpOrLeave,
      onClickCapture: handleClickCapture,
      onKeyDown: handleKeyDown,
    },
  };
}
