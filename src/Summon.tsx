import { useEffect, useRef, useState, type PointerEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalPosition } from "@tauri-apps/api/window";

export default function Summon() {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const windowStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);

  const [names, setNames] = useState("学生");
  const [message, setMessage] = useState("请立即到办公室一趟");

  useEffect(() => {
    // Disable context menu
    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  useEffect(() => {
    const handleSummonEvent = (e: any) => {
      try {
        const payload = JSON.parse(e.detail);
        const data = Array.isArray(payload) ? payload : [payload];
        if (data.length > 0) {
          setNames(data.map((s: any) => s.studentName).join("，"));
          setMessage(data[0].message || "请立即到办公室一趟");
          
          const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2026/2026-preview.mp3");
          audio.volume = 0.5;
          audio.play().catch(() => {});
        }
      } catch (err) {
        console.error("Parse summon error:", err);
      }
    };

    // We expose a global function for the Rust side to call
    (window as any).dispatchSummonEvent = (payload: string) => {
      const event = new CustomEvent("summonData", { detail: payload });
      window.dispatchEvent(event);
    };

    window.addEventListener("summonData", handleSummonEvent);

    return () => {
      window.removeEventListener("summonData", handleSummonEvent);
    };
  }, []);

  const handleDismiss = async () => {
    try {
      await invoke("hide_summon");
    } catch (e) {
      console.error("hide_summon error", e);
    }
  };

  const handlePointerDown = async (event: PointerEvent<HTMLDivElement>) => {
    // Only intercept if we are clicking on a draggable area (the background or the card header)
    if ((event.target as HTMLElement).tagName === 'BUTTON') return;
    
    pointerStartRef.current = { x: event.screenX, y: event.screenY };
    hasDraggedRef.current = false;
    
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
        await getCurrentWindow().startDragging();
      } else if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        const newX = windowStartRef.current.x + deltaX;
        const newY = windowStartRef.current.y + deltaY;
        await getCurrentWindow().setPosition(new LogicalPosition(newX, newY));
      }
    } catch (error) {
      console.error("Failed to drag summon window:", error);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerStartRef.current = null;
    windowStartRef.current = null;
    hasDraggedRef.current = false;
  };

  return (
    <div 
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        padding: '20px',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        touchAction: 'none'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#fff',
          borderRadius: '30px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '4px solid rgba(59, 130, 246, 0.2)',
          overflow: 'hidden',
          padding: '30px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '24px'
        }}
      >
        <div style={{
          height: '80px',
          width: '80px',
          borderRadius: '24px',
          backgroundColor: '#3b82f6',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)',
          pointerEvents: 'none',
          fontSize: '40px'
        }}>
          📢
        </div>
        
        <div style={{ pointerEvents: 'none' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#1f2937', margin: '0 0 8px 0' }}>
            ✨ 办公室传唤 ✨
          </h2>
          <p style={{ fontSize: '30px', fontWeight: 900, color: '#3b82f6', margin: 0, lineHeight: 1.2 }}>
            {names}
          </p>
        </div>

        <div style={{
          width: '100%',
          backgroundColor: 'rgba(243, 244, 246, 0.5)',
          borderRadius: '20px',
          padding: '24px',
          border: '2px solid rgba(229, 231, 235, 0.5)',
          pointerEvents: 'none',
          boxSizing: 'border-box'
        }}>
          <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
            “ {message} ”
          </p>
        </div>

        <button
          onClick={handleDismiss}
          style={{
            width: '100%',
            height: '56px',
            borderRadius: '20px',
            backgroundColor: '#1f2937',
            color: '#fff',
            fontSize: '20px',
            fontWeight: 900,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s',
            marginTop: '8px'
          }}
        >
          已收到指令
        </button>
      </div>
    </div>
  );
}