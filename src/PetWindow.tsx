import { useEffect, useState, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PetSprite, type PetAction } from "./PetSprite";

type State = "walking" | "sleeping" | "idle" | "interacting" | "dragging";

export default function PetWindow() {
  const [action, setAction] = useState<PetAction>("walk");
  const [isVisible, setIsVisible] = useState(true);
  const [scale, setScale] = useState(1.0);
  const [state, setState] = useState<State>("walking");

  const directionRef = useRef<"right" | "left">("right");
  const posXRef = useRef(100);
  const posYRef = useRef(400); // 当前行走的 Y 坐标（可被拖拽修改）
  const speed = 1.0;

  const lastStateRef = useRef<State>("walking");
  const lastActionRef = useRef<PetAction>("walk");

  // 拖拽相关
  const isDraggingRef = useRef(false);
  const dragStartScreenRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartWinRef = useRef<{ x: number; y: number } | null>(null);

  // 1. 监听远程控制
  useEffect(() => {
    const unlistenToggle = listen("pet:toggle", () => setIsVisible(v => !v));
    const unlistenScale = listen("pet:scale", (e: any) => {
      setScale(s => Math.max(0.5, Math.min(3, s + e.payload)));
    });
    return () => {
      unlistenToggle.then(f => f());
      unlistenScale.then(f => f());
    };
  }, []);

  // 2. 行为大脑（拖拽和交互时暂停）
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const brainTick = () => {
      if (state === "interacting" || state === "dragging") {
        timer = setTimeout(brainTick, 500);
        return;
      }
      const rand = Math.random();
      if (rand < 0.5) {
        setState("walking");
        setAction(directionRef.current === "right" ? "walk" : "walk_left");
      } else if (rand < 0.7) {
        setState("sleeping");
        setAction("sleep");
      } else if (rand < 0.85) {
        setState("idle");
        setAction("blink");
      } else {
        setState("idle");
        setAction("scratch");
      }
      timer = setTimeout(brainTick, 5000 + Math.random() * 10000);
    };
    brainTick();
    return () => clearTimeout(timer);
  }, [state]);

  // 3. 行走动画
  useEffect(() => {
    if (!isVisible || state !== "walking") return;
    let animationId: number;
    const updatePosition = () => {
      const screenW = window.screen.availWidth;
      const winSize = 500;

      if (directionRef.current === "right") {
        posXRef.current += speed;
        if (posXRef.current > screenW - winSize) {
          directionRef.current = "left";
          setAction("walk_left");
        }
      } else {
        posXRef.current -= speed;
        if (posXRef.current < 0) {
          directionRef.current = "right";
          setAction("walk");
        }
      }

      invoke("update_pet_position", {
        x: Math.round(posXRef.current),
        y: Math.round(posYRef.current),
      }).catch(console.error);

      animationId = requestAnimationFrame(updatePosition);
    };
    animationId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(animationId);
  }, [isVisible, state]);

  // 4. 拖拽开始
  const handlePointerDown = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartScreenRef.current = { x: e.screenX, y: e.screenY };
    // 获取当前窗口物理位置
    try {
      const pos = await getCurrentWindow().outerPosition();
      dragStartWinRef.current = { x: pos.x, y: pos.y };
    } catch (err) {
      console.error(err);
    }
    isDraggingRef.current = false;
  };

  // 5. 拖拽移动
  const handlePointerMove = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartScreenRef.current || !dragStartWinRef.current) return;
    const dx = e.screenX - dragStartScreenRef.current.x;
    const dy = e.screenY - dragStartScreenRef.current.y;
    if (!isDraggingRef.current && Math.hypot(dx, dy) < 5) return;

    if (!isDraggingRef.current) {
      isDraggingRef.current = true;
      setState("dragging");
      setAction("walk"); // 拖拽时播放行走动画
    }

    const newX = dragStartWinRef.current.x + dx;
    const newY = dragStartWinRef.current.y + dy;

    invoke("update_pet_position", {
      x: Math.round(newX),
      y: Math.round(newY),
    }).catch(console.error);
  };

  // 6. 拖拽结束 — 保存新 Y，恢复行走
  const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (isDraggingRef.current) {
      // 保存新的 X/Y 坐标
      try {
        const pos = await getCurrentWindow().outerPosition();
        posXRef.current = pos.x;
        posYRef.current = pos.y; // 猫咪将在这个高度来回走
      } catch (err) {
        console.error(err);
      }
      isDraggingRef.current = false;
      dragStartScreenRef.current = null;
      dragStartWinRef.current = null;
      // 恢复行走
      setState("walking");
      setAction(directionRef.current === "right" ? "walk" : "walk_left");
    } else {
      // 纯点击 → 触发互动
      dragStartScreenRef.current = null;
      dragStartWinRef.current = null;
      handleInteract();
    }
  };

  // 7. 鼠标点击互动
  const handleInteract = () => {
    if (state === "interacting" || state === "dragging") return;
    lastStateRef.current = state;
    lastActionRef.current = action;
    setState("interacting");
    setAction("interact");
    setTimeout(() => {
      setState(lastStateRef.current);
      setAction(lastActionRef.current);
    }, 1000);
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        width: "500px",
        height: "500px",
        backgroundColor: "transparent",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "bottom center",
          cursor: isDraggingRef.current ? "grabbing" : "grab",
          pointerEvents: "auto",
          touchAction: "none",
        }}
      >
        <PetSprite action={action} size={250} />
      </div>
    </div>
  );
}
