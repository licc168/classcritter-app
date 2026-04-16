import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalPosition } from "@tauri-apps/api/window";
import { useEffect, useRef, useState, type PointerEvent } from "react";

export default function Floating() {
  const [isHovered, setIsHovered] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const windowStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    // 全局禁用右键菜单，防止原生菜单遮挡
    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  const handleRestore = async () => {
    try {
      await invoke("restore_main");
    } catch (error) {
      console.error("Failed to restore main window:", error);
    }
  };

  const handlePointerDown = async (event: PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: event.screenX, y: event.screenY };
    hasDraggedRef.current = false;
    
    // 获取窗口当前位置，用于触摸屏手动计算拖拽
    try {
      const pos = await getCurrentWindow().outerPosition();
      windowStartRef.current = { x: pos.x, y: pos.y };
    } catch (error) {
      console.error("Failed to get window position:", error);
    }

    if (event.pointerType === 'touch') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handlePointerMove = async (event: PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current || !windowStartRef.current) {
      return;
    }

    const deltaX = event.screenX - pointerStartRef.current.x;
    const deltaY = event.screenY - pointerStartRef.current.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance < 4) {
      return;
    }

    hasDraggedRef.current = true;

    try {
      if (event.pointerType === 'mouse') {
        // 鼠标模式：使用 Tauri 原生拖拽 API
        await getCurrentWindow().startDragging();
      } else if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        // 触摸/触控笔模式：由于原生 startDragging 在 Windows 触摸屏会失效，改用手动计算并设置窗口位置
        const newX = windowStartRef.current.x + deltaX;
        const newY = windowStartRef.current.y + deltaY;
        await getCurrentWindow().setPosition(new LogicalPosition(newX, newY));
      }
    } catch (error) {
      console.error("Failed to drag floating window:", error);
    }
  };

  const handlePointerUp = async (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!hasDraggedRef.current) {
      await handleRestore();
    }

    pointerStartRef.current = null;
    windowStartRef.current = null;
    hasDraggedRef.current = false;
  };

  const handleRightClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await invoke("test_summon");
    } catch (error) {
      console.error('Failed to trigger test summon:', error);
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          position: "relative",
          backgroundColor: "rgba(255, 255, 255, 0.25)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
          cursor: "grab",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: isHovered ? "scale(1.05)" : "scale(1)",
          transition: "transform 0.2s",
          userSelect: "none",
          WebkitUserSelect: "none",
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={handleRightClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <svg
          width="60"
          height="60"
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        >
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="33%" stopColor="#818cf8" />
              <stop offset="66%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#f472b6" />
            </linearGradient>
          </defs>
          <circle cx="30" cy="30" r="28.5" fill="none" stroke="url(#ringGrad)" strokeWidth="3" />
        </svg>

        <img
          src="/logo.png"
          style={{
            width: "36px",
            height: "36px",
            objectFit: "contain",
            pointerEvents: "none",
            opacity: 0.95,
          }}
        />
      </div>
    </div>
  );
}
