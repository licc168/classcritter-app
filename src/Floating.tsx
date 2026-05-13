import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalPosition } from "@tauri-apps/api/window";
import { useRef, useState, type PointerEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Floating() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const windowStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const openMenu = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setMenuOpen(true);
  };

  const scheduleClose = () => {
    closeTimerRef.current = setTimeout(() => setMenuOpen(false), 300);
  };

  const handleRestore = async () => {
    if (hasDraggedRef.current) return;
    setMenuOpen(false);
    try { await invoke("restore_main"); } catch (e) { console.error(e); }
  };

  const handleOpenControl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    try { await invoke("pet_control_cmd"); } catch (e) { console.error(e); }
  };

  const handlePointerDown = async (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    pointerStartRef.current = { x: event.screenX, y: event.screenY };
    hasDraggedRef.current = false;
    try {
      const pos = await getCurrentWindow().outerPosition();
      windowStartRef.current = { x: pos.x, y: pos.y };
    } catch (e) { console.error(e); }
    if (event.pointerType === "touch") event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = async (event: PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current || !windowStartRef.current) return;
    const dx = event.screenX - pointerStartRef.current.x;
    const dy = event.screenY - pointerStartRef.current.y;
    if (Math.hypot(dx, dy) < 4) return;
    hasDraggedRef.current = true;
    try {
      if (event.pointerType === "mouse") {
        await getCurrentWindow().startDragging();
      } else {
        await getCurrentWindow().setPosition(
          new LogicalPosition(windowStartRef.current.x + dx, windowStartRef.current.y + dy)
        );
      }
    } catch (e) { console.error(e); }
  };

  const handlePointerUp = async (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") event.currentTarget.releasePointerCapture(event.pointerId);
    if (!hasDraggedRef.current && event.button === 0) await handleRestore();
    pointerStartRef.current = null;
    windowStartRef.current = null;
    hasDraggedRef.current = false;
  };

  return (
    <div
      style={{ width: "160px", height: "160px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "transparent" }}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <div style={{ position: "relative", width: "60px", height: "60px" }}>

        {/* 弹出菜单 */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.92 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onMouseEnter={openMenu}
              onMouseLeave={scheduleClose}
              style={{
                position: "absolute",
                bottom: "72px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "140px",
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderRadius: "16px",
                border: "1px solid rgba(255,255,255,0.6)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.8) inset",
                overflow: "hidden",
                pointerEvents: "auto",
              }}
            >
              <MenuItem
                emoji="🏠"
                label="显示主界面"
                onClick={(e) => { e.stopPropagation(); handleRestore(); }}
                color="#3b82f6"
              />
              <div style={{ height: "1px", background: "rgba(0,0,0,0.06)", margin: "0 12px" }} />
              <MenuItem
                emoji="🐱"
                label="宠物设置"
                onClick={handleOpenControl}
                color="#6366f1"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 小三角指示器 */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute",
                bottom: "64px",
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "6px solid rgba(255,255,255,0.92)",
                pointerEvents: "none",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
              }}
            />
          )}
        </AnimatePresence>

        {/* 中心图标 */}
        <div
          style={{
            width: "60px", height: "60px", borderRadius: "50%",
            backgroundColor: menuOpen ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.25)",
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            boxShadow: menuOpen ? "0 12px 28px rgba(0,0,0,0.28)" : "0 8px 20px rgba(0,0,0,0.2)",
            cursor: "grab", display: "flex", alignItems: "center", justifyContent: "center",
            transform: menuOpen ? "scale(1.08)" : "scale(1)",
            transition: "transform 0.2s, box-shadow 0.2s, background-color 0.2s",
            touchAction: "none", zIndex: 10, position: "relative",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={async (e) => { e.preventDefault(); await invoke("show_floating_menu"); }}
        >
          <svg width="60" height="60" style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#f472b6" />
              </linearGradient>
            </defs>
            <circle cx="30" cy="30" r="28.5" fill="none" stroke="url(#ringGrad)" strokeWidth="3" />
          </svg>
          <img src="/logo.png" style={{ width: "36px", height: "36px", objectFit: "contain", pointerEvents: "none" }} />
        </div>
      </div>
    </div>
  );
}

function MenuItem({ emoji, label, onClick, color }: { emoji: string; label: string; onClick: (e: React.MouseEvent) => void; color: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 14px",
        cursor: "pointer",
        borderRadius: "0",
        background: hovered ? `${color}15` : "transparent",
        transition: "background 0.15s",
      }}
    >
      <span style={{ fontSize: "16px", lineHeight: 1 }}>{emoji}</span>
      <span style={{
        fontSize: "13px",
        fontWeight: hovered ? 600 : 500,
        color: hovered ? color : "#374151",
        transition: "color 0.15s, font-weight 0.15s",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        {label}
      </span>
    </div>
  );
}
