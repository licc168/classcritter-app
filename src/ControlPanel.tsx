import { useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Plus, Minus, Eye, EyeOff, X, GripHorizontal } from "lucide-react";

export default function ControlPanel() {
  const [isPetOn, setIsPetOn] = useState(true);
  const [active, setActive] = useState(false);

  // 视觉反馈：点击时面板会闪烁一下
  const triggerFeedback = () => {
    setActive(true);
    setTimeout(() => setActive(false), 100);
  };

  const togglePet = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("Control: Toggle Pet");
    triggerFeedback();
    setIsPetOn(!isPetOn);
    emit("pet:toggle");
  };

  const scalePet = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    console.log("Control: Scale Pet", delta);
    triggerFeedback();
    emit("pet:scale", delta);
  };

  const closePanel = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("Control: Close Panel");
    getCurrentWindow().hide();
  };

  const startDragging = () => {
    console.log("Control: Dragging");
    getCurrentWindow().startDragging();
  };

  return (
    <div 
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
        userSelect: "none"
      }}
    >
      <div 
        style={{
          width: "220px",
          height: "54px",
          backgroundColor: active ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: "27px",
          border: "2px solid #6366f1",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          transition: "background-color 0.1s"
        }}
      >
        {/* 拖动手柄 - 整个左侧区域都可以拖动 */}
        <div 
          onPointerDown={startDragging}
          style={{ 
            cursor: "grab", 
            color: "#64748b", 
            padding: "10px",
            display: "flex", 
            alignItems: "center" 
          }}
        >
          <GripHorizontal size={20} />
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button 
            onClick={(e) => togglePet(e)}
            style={btnStyle}
          >
            {isPetOn ? <Eye size={18} color="#3b82f6" /> : <EyeOff size={18} color="#94a3b8" />}
          </button>
          <button 
            onClick={(e) => scalePet(e, 0.2)} 
            style={btnStyle}
          >
            <Plus size={20} color="#10b981" />
          </button>
          <button 
            onClick={(e) => scalePet(e, -0.2)} 
            style={btnStyle}
          >
            <Minus size={20} color="#f59e0b" />
          </button>
        </div>

        <div 
          onClick={(e) => closePanel(e)}
          style={{ 
            cursor: "pointer", 
            color: "#ef4444", 
            padding: "8px",
            display: "flex",
            alignItems: "center"
          }}
        >
          <X size={18} />
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "white",
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
  outline: "none"
};
