import { useState, useEffect } from "react";

export type PetAction = "walk" | "walk_left" | "sleep" | "scratch" | "blink" | "teaser" | "jump" | "interact";

interface PetSpriteProps {
  action: PetAction;
  fps?: number;
  size?: number;
}

const ACTION_CONFIG: Record<string, { frames: number[]; fps: number }> = {
  walk:      { frames: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], fps: 12 },
  walk_left: { frames: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], fps: 12 },
  sleep:     { frames: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], fps: 6 },
  blink:     { frames: [11], fps: 1 },
  scratch:   { frames: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], fps: 12 },
  jump:      { frames: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], fps: 14 },
  // 交互：用前爪扑打
  interact:  { frames: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], fps: 16 },
  teaser:    { frames: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], fps: 12 },
};

export function PetSprite({ action, fps: fpsProp, size = 120 }: PetSpriteProps) {
  const [index, setIndex] = useState(0);

  const config = ACTION_CONFIG[action] || ACTION_CONFIG.walk;
  const frames = config.frames;
  const fps = fpsProp ?? config.fps;

  useEffect(() => {
    setIndex(0);
  }, [action]);

  useEffect(() => {
    if (frames.length <= 1) return; 
    
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % frames.length);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [action, fps, frames.length]);

  const frameIndex = frames[index] ?? frames[0];

  return (
    <div
      style={{
        width: size,
        height: size,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          width: `${frames.length * 100}%`,
          height: "100%",
          transform: `translateX(-${(index / frames.length) * 100}%)`,
          transition: "none",
          willChange: "transform",
        }}
      >
        {frames.map((fIndex) => (
          <img
            key={`${action}-${fIndex}`}
            src={`/assets/pet/${action}/frame_${fIndex}.png`}
            alt="pet"
            style={{
              width: size,
              height: size,
              flexShrink: 0,
              objectFit: "contain",
              imageRendering: "auto",
            }}
            onError={(e) => {
              if (action !== "walk") {
                (e.target as HTMLImageElement).src = `/assets/pet/walk/frame_${fIndex}.png`;
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
