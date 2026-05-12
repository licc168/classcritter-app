import { useEffect, useState, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { PetSprite, type PetAction } from "./PetSprite";

type State = "walking" | "sleeping" | "idle";

export default function PetWindow() {
  const [action, setAction] = useState<PetAction>("walk");
  const [posX, setPosX] = useState(100);
  const [isVisible, setIsVisible] = useState(true);
  const [scale, setScale] = useState(1.0);
  
  const [state, setState] = useState<State>("walking");
  const directionRef = useRef<"right" | "left">("right");
  const posXRef = useRef(100); // 使用 Ref 同步坐标，避免闭包问题
  const speed = 1.0;

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

  // 2. 行为大脑：每隔一段时间决定做什么
  useEffect(() => {
    const brainTick = () => {
      const rand = Math.random();
      if (rand < 0.6) {
        setState("walking");
        setAction(directionRef.current === "right" ? "walk" : "walk_left");
      } else if (rand < 0.9) {
        setState("sleeping");
        setAction("sleep");
      } else {
        setState("idle");
        setAction(directionRef.current === "right" ? "walk" : "walk_left"); // 站着不动
      }
      
      // 随机设定下一次思考的时间 (5~15秒)
      setTimeout(brainTick, 5000 + Math.random() * 10000);
    };

    brainTick();
  }, []);

  // 3. 物理移动逻辑
  useEffect(() => {
    if (!isVisible || state !== "walking") return;

    let animationId: number;
    const updatePosition = () => {
      const screenWidth = window.innerWidth;
      const petSize = 120 * scale;

      if (directionRef.current === "right") {
        posXRef.current += speed;
        if (posXRef.current > screenWidth - petSize) {
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

      setPosX(posXRef.current);
      animationId = requestAnimationFrame(updatePosition);
    };

    animationId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(animationId);
  }, [isVisible, state, scale]);

  if (!isVisible) return null;

  return (
    <div style={{ width: "100vw", height: "100vh", backgroundColor: "transparent", position: "relative", overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          bottom: `${40 + (scale - 1) * 30}px`,
          left: 0,
          transform: `translateX(${posX}px) scale(${scale})`,
          transformOrigin: "bottom center",
          width: "120px", height: "120px",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.016s linear, opacity 0.5s",
        }}
      >
        <PetSprite action={action} size={120 * scale} />
      </div>
    </div>
  );
}
