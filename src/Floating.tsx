import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalPosition } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, Eye, EyeOff, X } from "lucide-react";

export default function Floating() {
  const [isHovered, setIsHovered] = useState(false);
  const [isPetOn, setIsPetOn] = useState(true);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const windowStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);

  const togglePet = () => {
    setIsPetOn(!isPetOn);
    emit("pet:toggle");
  };

  const scalePet = (delta: number) => {
    emit("pet:scale", delta);
  };

  useEffect(() => {
    const handleContextMenu = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  const handleRestore = async () => {
    if (hasDraggedRef.current) return;
    try {
      await invoke("restore_main");
    } catch (error) {
      console.error(error);
    }
  };

  // 拖拽逻辑保持不变...
  const handlePointerDown = async (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    pointerStartRef.current = { x: event.screenX, y: event.screenY };
    hasDraggedRef.current = false;
    try {
      const pos = await getCurrentWindow().outerPosition();
      windowStartRef.current = { x: pos.x, y: pos.y };
    } catch (error) { console.error(error); }
    if (event.pointerType === 'touch') event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = async (event: PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current || !windowStartRef.current) return;
    const deltaX = event.screenX - pointerStartRef.current.x;
    const deltaY = event.screenY - pointerStartRef.current.y;
    if (Math.hypot(deltaX, deltaY) < 4) return;
    hasDraggedRef.current = true;
    try {
      if (event.pointerType === 'mouse') {
        await getCurrentWindow().startDragging();
      } else {
        const newX = windowStartRef.current.x + deltaX;
        const newY = windowStartRef.current.y + deltaY;
        await getCurrentWindow().setPosition(new LogicalPosition(newX, newY));
      }
    } catch (error) { console.error(error); }
  };

  const handlePointerUp = async (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') event.currentTarget.releasePointerCapture(event.pointerId);
    if (!hasDraggedRef.current && event.button === 0) {
      // 检查是否点击的是按钮区域，如果不是才恢复主窗口
      if ((event.target as HTMLElement).closest(".pet-control-btn")) return;
      await handleRestore();
    }
    pointerStartRef.current = null;
    windowStartRef.current = null;
    hasDraggedRef.current = false;
  };

  return (
    <div style={{ width: "160px", height: "160px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "transparent" }}>
      <div
        style={{ position: "relative", width: "60px", height: "60px" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 控制菜单 */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{ position: "absolute", width: "140px", height: "140px", top: "-40px", left: "-40px", pointerEvents: "none" }}
            >
              <ControlBtn 
                icon={isPetOn ? <Eye size={16} /> : <EyeOff size={16} />} 
                top={0} left={50} 
                onClick={togglePet} 
                color={isPetOn ? "#3b82f6" : "#94a3b8"}
              />
              <ControlBtn 
                icon={<Plus size={16} />} 
                top={45} left={105} 
                onClick={() => scalePet(0.2)} 
                color="#10b981"
              />
              <ControlBtn 
                icon={<Minus size={16} />} 
                top={45} left={-5} 
                onClick={() => scalePet(-0.2)} 
                color="#f59e0b"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 中心图标 */}
        <div
          className="main-icon"
          style={{
            width: "60px", height: "60px", borderRadius: "50%",
            backgroundColor: "rgba(255, 255, 255, 0.25)",
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
            cursor: "grab", display: "flex", alignItems: "center", justifyContent: "center",
            transform: isHovered ? "scale(1.05)" : "scale(1)", transition: "transform 0.2s",
            touchAction: "none", zIndex: 10
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={async (e) => {
            e.preventDefault();
            await invoke("show_floating_menu");
          }}
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

function ControlBtn({ icon, top, left, onClick, color }: any) {
  return (
    <motion.div
      className="pet-control-btn"
      whileHover={{ scale: 1.2 }}
      whileTap={{ scale: 0.9 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        position: "absolute", top, left,
        width: "32px", height: "32px", borderRadius: "50%",
        backgroundColor: "white", color: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        cursor: "pointer", pointerEvents: "auto",
        border: `2px solid ${color}`
      }}
    >
      {icon}
    </motion.div>
  );
}
