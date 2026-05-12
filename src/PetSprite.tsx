import { useState, useEffect } from "react";

export type PetAction = "walk" | "walk_left" | "sleep" | "scratch" | "teaser";

interface PetSpriteProps {
  action: PetAction;
  fps?: number;
  size?: number;
}

export function PetSprite({ action, fps = 12, size = 120 }: PetSpriteProps) {
  const [frame, setFrame] = useState(0);
  const frameCount = 16;

  useEffect(() => {
    // 切换动作时重置到第一帧
    setFrame(0);
    
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % frameCount);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [action, fps]);

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <img
        src={`/assets/pet/${action}/frame_${frame}.png`}
        alt="pet"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          // 强制使用最高质量缩放算法
          imageRendering: "high-quality",
          // 硬件加速，防止位移导致的模糊
          transform: "translateZ(0)",
          willChange: "transform",
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
        }}
        onError={(e) => {
          // 如果某个动作图片不存在，回退到 walk
          if (action !== "walk") {
            console.warn(`Action ${action} not found, falling back to walk`);
            (e.target as HTMLImageElement).src = `/assets/pet/walk/frame_${frame}.png`;
          }
        }}
      />
    </div>
  );
}
