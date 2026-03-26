"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface ResizableSplitProps {
  top: React.ReactNode;
  bottom: React.ReactNode;
  defaultRatio?: number;
  minRatio?: number;
  maxRatio?: number;
}

export default function ResizableSplit({
  top,
  bottom,
  defaultRatio = 0.5,
  minRatio = 0.2,
  maxRatio = 0.8,
}: ResizableSplitProps) {
  const [ratio, setRatio] = useState(defaultRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;

      const onMouseMove = (e: MouseEvent) => {
        if (!draggingRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const newRatio = Math.max(minRatio, Math.min(maxRatio, y / rect.height));
        setRatio(newRatio);
      };

      const onMouseUp = () => {
        draggingRef.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [minRatio, maxRatio]
  );

  // Touch support
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      draggingRef.current = true;

      const onTouchMove = (e: TouchEvent) => {
        if (!draggingRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const y = e.touches[0].clientY - rect.top;
        const newRatio = Math.max(minRatio, Math.min(maxRatio, y / rect.height));
        setRatio(newRatio);
      };

      const onTouchEnd = () => {
        draggingRef.current = false;
        document.removeEventListener("touchmove", onTouchMove);
        document.removeEventListener("touchend", onTouchEnd);
      };

      document.addEventListener("touchmove", onTouchMove);
      document.addEventListener("touchend", onTouchEnd);
    },
    [minRatio, maxRatio]
  );

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* Top panel */}
      <div style={{ height: `${ratio * 100}%` }} className="min-h-0 overflow-hidden">
        {top}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="h-2 flex-shrink-0 cursor-row-resize bg-gray-800 border-y border-gray-700
                   hover:bg-gray-700 transition-colors flex items-center justify-center group"
      >
        <div className="flex gap-1">
          <div className="w-6 h-0.5 rounded bg-gray-600 group-hover:bg-gray-400 transition-colors" />
        </div>
      </div>

      {/* Bottom panel */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {bottom}
      </div>
    </div>
  );
}
