import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
type GameState = "start" | "playing" | "gameover";
type ObstacleType = "cow" | "auto" | "cyclist" | "pothole" | "pedestrian";
type BgType = "palmtree" | "hut" | "bush" | "crop";

interface Obstacle {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  type: ObstacleType;
}

interface BgElement {
  x: number;
  y: number;
  type: BgType;
  side: "left" | "right";
  scale: number;
}

interface GameRef {
  state: GameState;
  playerX: number;
  playerTargetX: number;
  playerY: number;
  playerW: number;
  playerH: number;
  speed: number;
  score: number;
  lives: number;
  highScore: number;
  invincible: boolean;
  invincibleTimer: number;
  obstacles: Obstacle[];
  bgElements: BgElement[];
  nextObstacleIn: number;
  frameCount: number;
  roadX: number;
  roadW: number;
  lanePositions: number[];
  currentLane: number;
  canvasW: number;
  canvasH: number;
  obstacleIdCounter: number;
  bgScrollY: number;
  laneChangeCooldown: number;
}

const LANE_COUNT = 3;

// ─── Pure drawing helpers (no React, no closures needed) ─────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, gs: GameRef) {
  const { canvasW, canvasH, roadX, roadW, bgScrollY } = gs;

  // Sky strip at top
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvasH * 0.12);
  skyGrad.addColorStop(0, "#7EC8E3");
  skyGrad.addColorStop(1, "#B0D8E8");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvasW, canvasH * 0.12);

  // Left field
  ctx.fillStyle = "#3D7A4A";
  ctx.fillRect(0, canvasH * 0.12, roadX, canvasH);

  // Right field
  ctx.fillStyle = "#3D7A4A";
  ctx.fillRect(roadX + roadW, canvasH * 0.12, canvasW - roadX - roadW, canvasH);

  // Crop stripes
  const stripeH = 36;
  const offset = bgScrollY % (stripeH * 2);
  ctx.fillStyle = "#4E9960";
  for (let y = -stripeH * 2 + offset; y < canvasH + stripeH; y += stripeH * 2) {
    ctx.fillRect(0, canvasH * 0.12 + y, roadX, stripeH);
    ctx.fillRect(
      roadX + roadW,
      canvasH * 0.12 + y,
      canvasW - roadX - roadW,
      stripeH,
    );
  }

  // Road base
  ctx.fillStyle = "#C4956A";
  ctx.fillRect(roadX, 0, roadW, canvasH);

  // Road texture
  ctx.fillStyle = "#B8845A";
  ctx.globalAlpha = 0.18;
  const texOffset = (bgScrollY * 1.2) % 38;
  for (let y = -38 + texOffset; y < canvasH + 38; y += 38) {
    ctx.fillRect(roadX + 10, y, roadW - 20, 2);
  }
  ctx.globalAlpha = 1;

  // Road edges
  ctx.fillStyle = "#8B6355";
  ctx.fillRect(roadX, 0, 7, canvasH);
  ctx.fillRect(roadX + roadW - 7, 0, 7, canvasH);

  // Lane dividers (dashed)
  const laneW = roadW / LANE_COUNT;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([28, 18]);
  ctx.lineDashOffset = -(bgScrollY % 46);
  for (let lane = 1; lane < LANE_COUNT; lane++) {
    const lx = roadX + laneW * lane;
    ctx.beginPath();
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx, canvasH);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawBgElement(ctx: CanvasRenderingContext2D, el: BgElement) {
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.scale(el.scale, el.scale);

  switch (el.type) {
    case "palmtree": {
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(4, 4, 6, 20, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Trunk
      ctx.fillStyle = "#8B6914";
      ctx.fillRect(-4, -48, 8, 48);
      // Leaves
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate((i / 6) * Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? "#2D6A2D" : "#3A8A3A";
        ctx.beginPath();
        ctx.ellipse(0, -58, 7, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Coconuts
      ctx.fillStyle = "#8B5E20";
      ctx.beginPath();
      ctx.arc(-4, -48, 4, 0, Math.PI * 2);
      ctx.arc(5, -50, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "hut": {
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(5, 5, 24, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Walls
      ctx.fillStyle = "#D4906A";
      ctx.fillRect(-22, -22, 44, 22);
      // Thatch roof
      ctx.fillStyle = "#A0712A";
      ctx.beginPath();
      ctx.moveTo(-28, -22);
      ctx.lineTo(0, -50);
      ctx.lineTo(28, -22);
      ctx.fill();
      ctx.fillStyle = "#C48A35";
      ctx.beginPath();
      ctx.moveTo(-24, -22);
      ctx.lineTo(0, -46);
      ctx.lineTo(24, -22);
      ctx.fill();
      // Door
      ctx.fillStyle = "#5C3317";
      ctx.beginPath();
      ctx.roundRect(-7, -18, 14, 18, [3, 3, 0, 0]);
      ctx.fill();
      // Window
      ctx.fillStyle = "#87CEEB";
      ctx.fillRect(10, -18, 8, 7);
      break;
    }
    case "bush": {
      ctx.fillStyle = "#2A6A2A";
      ctx.beginPath();
      ctx.arc(0, -10, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3A8A3A";
      ctx.beginPath();
      ctx.arc(-10, -6, 10, 0, Math.PI * 2);
      ctx.arc(10, -5, 10, 0, Math.PI * 2);
      ctx.arc(0, -14, 9, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "crop": {
      for (let i = -18; i <= 18; i += 7) {
        ctx.strokeStyle = "#6B9E6B";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, -22);
        ctx.stroke();
        ctx.fillStyle = "#D4AA50";
        ctx.beginPath();
        ctx.ellipse(i, -24, 2, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

function drawPlayerCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  flash: boolean,
) {
  ctx.globalAlpha = flash ? 0.35 : 1;
  const hw = w / 2;
  const hh = h / 2;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x + 3, y + hh - 4, hw * 0.85, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Car body
  ctx.fillStyle = "#E8402A";
  ctx.beginPath();
  ctx.roundRect(x - hw, y - hh, w, h, 6);
  ctx.fill();

  // Cabin top
  ctx.fillStyle = "#C02A1A";
  ctx.beginPath();
  ctx.roundRect(x - hw * 0.72, y - hh + h * 0.14, w * 0.72, h * 0.42, 5);
  ctx.fill();

  // Front windshield
  ctx.fillStyle = "#B8E4F0";
  ctx.globalAlpha = flash ? 0.2 : 0.82;
  ctx.beginPath();
  ctx.roundRect(x - hw * 0.6, y - hh + h * 0.17, w * 0.6, h * 0.18, 3);
  ctx.fill();

  // Rear window
  ctx.beginPath();
  ctx.roundRect(x - hw * 0.56, y - hh + h * 0.41, w * 0.56, h * 0.13, 3);
  ctx.fill();
  ctx.globalAlpha = flash ? 0.35 : 1;

  // Gold stripe
  ctx.fillStyle = "#FFD700";
  ctx.fillRect(x - hw, y - hh + h * 0.6, w, 5);

  // Wheels
  ctx.fillStyle = "#1A1A1A";
  const ww = w * 0.23;
  const wh = h * 0.16;
  const wr = 3;
  // Front wheels
  ctx.beginPath();
  ctx.roundRect(x - hw - ww * 0.25, y - hh + h * 0.08, ww, wh, wr);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + hw - ww * 0.75, y - hh + h * 0.08, ww, wh, wr);
  ctx.fill();
  // Rear wheels
  ctx.beginPath();
  ctx.roundRect(x - hw - ww * 0.25, y - hh + h * 0.75, ww, wh, wr);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + hw - ww * 0.75, y - hh + h * 0.75, ww, wh, wr);
  ctx.fill();

  // Wheel rims
  ctx.fillStyle = "#C0C0C0";
  ctx.beginPath();
  ctx.arc(
    x - hw + ww * 0.25,
    y - hh + h * 0.08 + wh / 2,
    wh * 0.28,
    0,
    Math.PI * 2,
  );
  ctx.arc(
    x + hw - ww * 0.25,
    y - hh + h * 0.08 + wh / 2,
    wh * 0.28,
    0,
    Math.PI * 2,
  );
  ctx.arc(
    x - hw + ww * 0.25,
    y - hh + h * 0.75 + wh / 2,
    wh * 0.28,
    0,
    Math.PI * 2,
  );
  ctx.arc(
    x + hw - ww * 0.25,
    y - hh + h * 0.75 + wh / 2,
    wh * 0.28,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // Headlights
  ctx.fillStyle = "#FFFAAA";
  ctx.beginPath();
  ctx.ellipse(x - hw * 0.5, y + hh - 7, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + hw * 0.5, y + hh - 7, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
  const { x, y, w, h, type } = obs;
  const hw = w / 2;
  const hh = h / 2;

  switch (type) {
    case "cow": {
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(x + 3, y + hh * 0.8, hw * 0.8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillStyle = "#F5F5DC";
      ctx.beginPath();
      ctx.ellipse(x, y + hh * 0.1, hw * 0.9, hh * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.beginPath();
      ctx.ellipse(x, y - hh * 0.5, hw * 0.45, hh * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      // Spots
      ctx.fillStyle = "#4A4A4A";
      ctx.beginPath();
      ctx.ellipse(x - hw * 0.3, y, hw * 0.22, hh * 0.2, 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(
        x + hw * 0.3,
        y + hh * 0.15,
        hw * 0.16,
        hh * 0.14,
        -0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      // Horns
      ctx.strokeStyle = "#C8A040";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.2, y - hh * 0.82);
      ctx.quadraticCurveTo(
        x - hw * 0.52,
        y - hh * 1.1,
        x - hw * 0.28,
        y - hh * 0.95,
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + hw * 0.2, y - hh * 0.82);
      ctx.quadraticCurveTo(
        x + hw * 0.52,
        y - hh * 1.1,
        x + hw * 0.28,
        y - hh * 0.95,
      );
      ctx.stroke();
      // Legs
      ctx.fillStyle = "#E0E0B8";
      const legPairs = [
        [-hw * 0.42, -hw * 0.18],
        [hw * 0.18, hw * 0.42],
      ];
      for (const [lx1, lx2] of legPairs) {
        ctx.fillRect(x + lx1 - 4, y + hh * 0.52, 7, hh * 0.48);
        ctx.fillRect(x + lx2 - 4, y + hh * 0.52, 7, hh * 0.48);
      }
      // Tail
      ctx.strokeStyle = "#D0D0A0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + hw * 0.85, y);
      ctx.quadraticCurveTo(
        x + hw * 1.1,
        y - hh * 0.3,
        x + hw * 0.9,
        y - hh * 0.6,
      );
      ctx.stroke();
      // Eye
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.arc(x - hw * 0.18, y - hh * 0.58, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "auto": {
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(x + 3, y + hh + 4, hw * 0.75, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillStyle = "#4A9E3A";
      ctx.beginPath();
      ctx.roundRect(x - hw, y - hh * 0.4, w, h * 0.7, [4, 4, 2, 2]);
      ctx.fill();
      // Roof
      ctx.fillStyle = "#FFD700";
      ctx.beginPath();
      ctx.roundRect(
        x - hw * 0.88,
        y - hh - h * 0.12,
        w * 0.88,
        h * 0.35,
        [5, 5, 0, 0],
      );
      ctx.fill();
      // Windshield
      ctx.fillStyle = "#B8E4F0";
      ctx.globalAlpha = 0.8;
      ctx.fillRect(x - hw * 0.75, y - hh * 0.35, w * 0.7, h * 0.26);
      ctx.globalAlpha = 1;
      // Cabin side
      ctx.fillStyle = "#3A8A2A";
      ctx.fillRect(x - hw * 0.88, y - hh * 0.35, 8, h * 0.26);
      // Wheels
      ctx.fillStyle = "#1A1A1A";
      ctx.beginPath();
      ctx.arc(x - hw * 0.6, y + hh * 0.65, h * 0.17, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + hw * 0.6, y + hh * 0.65, h * 0.17, 0, Math.PI * 2);
      ctx.fill();
      // Rim
      ctx.fillStyle = "#C0C0C0";
      ctx.beginPath();
      ctx.arc(x - hw * 0.6, y + hh * 0.65, h * 0.08, 0, Math.PI * 2);
      ctx.arc(x + hw * 0.6, y + hh * 0.65, h * 0.08, 0, Math.PI * 2);
      ctx.fill();
      // Yellow stripe
      ctx.fillStyle = "#FFD700";
      ctx.fillRect(x - hw, y + hh * 0.18, w, 4);
      // Headlight
      ctx.fillStyle = "#FFFAAA";
      ctx.beginPath();
      ctx.ellipse(x, y + hh * 0.5, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "cyclist": {
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(x + 2, y + hh + 3, hw * 0.7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Wheels
      ctx.strokeStyle = "#2A2A2A";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x - hw * 0.25, y + hh * 0.45, hw * 0.44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + hw * 0.3, y + hh * 0.45, hw * 0.44, 0, Math.PI * 2);
      ctx.stroke();
      // Spokes
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#555";
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(x - hw * 0.25, y + hh * 0.45);
        ctx.rotate((i / 4) * Math.PI);
        ctx.beginPath();
        ctx.moveTo(0, -hw * 0.44);
        ctx.lineTo(0, hw * 0.44);
        ctx.stroke();
        ctx.restore();
      }
      // Frame
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.25, y + hh * 0.45);
      ctx.lineTo(x + hw * 0.05, y - hh * 0.15);
      ctx.lineTo(x + hw * 0.3, y + hh * 0.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + hw * 0.05, y - hh * 0.15);
      ctx.lineTo(x - hw * 0.1, y + hh * 0.45);
      ctx.stroke();
      // Handlebar
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.3, y - hh * 0.3);
      ctx.lineTo(x + hw * 0.15, y - hh * 0.3);
      ctx.stroke();
      // Rider
      ctx.fillStyle = "#FF6B35";
      ctx.beginPath();
      ctx.ellipse(
        x - hw * 0.05,
        y - hh * 0.3,
        hw * 0.38,
        hh * 0.42,
        -0.35,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      // Head
      ctx.fillStyle = "#FDBCB4";
      ctx.beginPath();
      ctx.arc(x - hw * 0.2, y - hh * 0.78, hw * 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Helmet
      ctx.fillStyle = "#E74C3C";
      ctx.beginPath();
      ctx.arc(x - hw * 0.2, y - hh * 0.83, hw * 0.33, Math.PI, 0);
      ctx.fill();
      break;
    }
    case "pothole": {
      // Outer shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(x + 3, y + 3, hw * 0.92, hh * 0.58, 0.15, 0, Math.PI * 2);
      ctx.fill();
      // Main pothole
      ctx.fillStyle = "#4A2810";
      ctx.beginPath();
      ctx.ellipse(x, y, hw * 0.9, hh * 0.58, 0.15, 0, Math.PI * 2);
      ctx.fill();
      // Inner reflection
      ctx.fillStyle = "#3A1E0A";
      ctx.beginPath();
      ctx.ellipse(
        x - hw * 0.12,
        y - hh * 0.08,
        hw * 0.55,
        hh * 0.33,
        0.1,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      // Highlight
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.ellipse(
        x - hw * 0.25,
        y - hh * 0.2,
        hw * 0.28,
        hh * 0.16,
        -0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      // Gravel edges
      ctx.fillStyle = "#9A7050";
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const rx = x + Math.cos(angle) * hw * 0.88;
        const ry = y + Math.sin(angle) * hh * 0.5;
        ctx.beginPath();
        ctx.arc(rx, ry, 2 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "pedestrian": {
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(x + 2, y + hh + 3, hw * 0.5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Legs
      ctx.fillStyle = "#5C3317";
      ctx.fillRect(x - hw * 0.22, y + hh * 0.18, hw * 0.3, hh * 0.82);
      ctx.fillRect(x + hw * 0.08, y + hh * 0.18, hw * 0.3, hh * 0.82);
      // Saree body
      ctx.fillStyle = "#E91E8C";
      ctx.beginPath();
      ctx.roundRect(x - hw * 0.42, y - hh * 0.12, w * 0.56, hh * 0.7, 3);
      ctx.fill();
      // Saree drape accent
      ctx.fillStyle = "#FF69B4";
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.42, y - hh * 0.12);
      ctx.lineTo(x + hw * 0.14, y - hh * 0.12);
      ctx.lineTo(x - hw * 0.05, y + hh * 0.52);
      ctx.lineTo(x - hw * 0.55, y + hh * 0.52);
      ctx.closePath();
      ctx.fill();
      // Saree gold border
      ctx.fillStyle = "#FFD700";
      ctx.fillRect(x - hw * 0.42, y + hh * 0.48, w * 0.56, 3);
      // Head
      ctx.fillStyle = "#FDBCB4";
      ctx.beginPath();
      ctx.arc(x - hw * 0.12, y - hh * 0.5, hw * 0.37, 0, Math.PI * 2);
      ctx.fill();
      // Hair bun
      ctx.fillStyle = "#2A1A0A";
      ctx.beginPath();
      ctx.arc(x - hw * 0.12, y - hh * 0.82, hw * 0.26, 0, Math.PI * 2);
      ctx.fill();
      // Bindi
      ctx.fillStyle = "#E91E8C";
      ctx.beginPath();
      ctx.arc(x - hw * 0.12, y - hh * 0.56, 2, 0, Math.PI * 2);
      ctx.fill();
      // Arm with basket
      ctx.fillStyle = "#FDBCB4";
      ctx.beginPath();
      ctx.ellipse(
        x + hw * 0.22,
        y - hh * 0.1,
        5,
        hw * 0.32,
        -0.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = "#C8922A";
      ctx.beginPath();
      ctx.ellipse(x + hw * 0.38, y - hh * 0.28, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

function drawHUD(ctx: CanvasRenderingContext2D, gs: GameRef) {
  const { canvasW, score, lives, highScore, speed } = gs;

  // HUD bar
  ctx.fillStyle = "rgba(10,5,0,0.72)";
  ctx.fillRect(0, 0, canvasW, 54);
  ctx.fillStyle = "rgba(255,165,0,0.15)";
  ctx.fillRect(0, 53, canvasW, 1);

  // Score
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 17px 'Bricolage Grotesque', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`Score: ${Math.floor(score)}`, 14, 27);

  // Speed
  ctx.fillStyle = "rgba(255,200,100,0.65)";
  ctx.font = "12px 'Figtree', sans-serif";
  ctx.fillText(`${Math.floor(speed * 18)} km/h`, 14, 45);

  // High score
  ctx.fillStyle = "#FFA040";
  ctx.font = "bold 15px 'Bricolage Grotesque', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Best: ${Math.floor(highScore)}`, canvasW / 2, 27);

  // Lives (mini car icons)
  for (let i = 0; i < 3; i++) {
    const lx = canvasW - 18 - i * 30;
    const ly = 14;
    if (i < lives) {
      ctx.fillStyle = "#E8402A";
      ctx.beginPath();
      ctx.roundRect(lx - 9, ly, 18, 26, 3);
      ctx.fill();
      ctx.fillStyle = "#FFD700";
      ctx.fillRect(lx - 9, ly + 15, 18, 3);
      ctx.fillStyle = "rgba(184,228,240,0.8)";
      ctx.beginPath();
      ctx.roundRect(lx - 7, ly + 2, 14, 8, 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.roundRect(lx - 9, ly, 18, 26, 3);
      ctx.fill();
    }
  }
}

function drawStartScreen(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  time: number,
) {
  // Sky gradient - warm sunrise
  const sky = ctx.createLinearGradient(0, 0, 0, ch * 0.55);
  sky.addColorStop(0, "#FF4500");
  sky.addColorStop(0.35, "#FF8C00");
  sky.addColorStop(0.65, "#FFD700");
  sky.addColorStop(1, "#87CEEB");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, cw, ch * 0.55);

  // Ground
  ctx.fillStyle = "#3D7A4A";
  ctx.fillRect(0, ch * 0.55, cw, ch * 0.45);

  // Sun with rays
  const sunX = cw * 0.78;
  const sunY = ch * 0.16;
  ctx.fillStyle = "rgba(255,240,80,0.22)";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,240,80,0.35)";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFE055";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 36, 0, Math.PI * 2);
  ctx.fill();

  // Temple silhouette
  const tx = cw * 0.08;
  const ty = ch * 0.3;
  ctx.fillStyle = "rgba(80,30,10,0.85)";
  // Base
  ctx.fillRect(tx, ty + 55, 90, 80);
  // Main shikhara
  ctx.beginPath();
  ctx.moveTo(tx - 12, ty + 55);
  ctx.lineTo(tx + 45, ty + 5);
  ctx.lineTo(tx + 102, ty + 55);
  ctx.fill();
  // Upper shikhara
  ctx.beginPath();
  ctx.moveTo(tx + 22, ty + 10);
  ctx.lineTo(tx + 45, ty - 22);
  ctx.lineTo(tx + 68, ty + 10);
  ctx.fill();
  // Spire
  ctx.fillRect(tx + 40, ty - 45, 10, 28);
  ctx.beginPath();
  ctx.arc(tx + 45, ty - 48, 6, 0, Math.PI * 2);
  ctx.fill();
  // Door arch
  ctx.fillStyle = "rgba(255,120,20,0.4)";
  ctx.beginPath();
  ctx.roundRect(tx + 34, ty + 85, 22, 28, [11, 11, 0, 0]);
  ctx.fill();

  // Palm trees
  for (let i = 0; i < 3; i++) {
    const px = cw * 0.52 + i * 55;
    const py = ch * 0.52;
    ctx.fillStyle = "#8B6914";
    ctx.fillRect(px - 4, py - 62, 8, 62);
    for (let j = 0; j < 6; j++) {
      ctx.save();
      ctx.translate(px, py - 62);
      ctx.rotate((j / 6) * Math.PI * 2);
      ctx.fillStyle = j % 2 === 0 ? "#2D6A2D" : "#3A8A3A";
      ctx.beginPath();
      ctx.ellipse(0, -22, 5, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Road preview
  ctx.fillStyle = "#C4956A";
  ctx.fillRect(cw * 0.38, ch * 0.55, cw * 0.24, ch * 0.45);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 14]);
  ctx.lineDashOffset = -(time / 30) % 34;
  ctx.beginPath();
  ctx.moveTo(cw * 0.5, ch * 0.55);
  ctx.lineTo(cw * 0.5, ch);
  ctx.stroke();
  ctx.setLineDash([]);

  // Huts
  const hutData = [
    [cw * 0.08, ch * 0.6],
    [cw * 0.72, ch * 0.62],
  ];
  for (const [hx, hy] of hutData) {
    ctx.fillStyle = "#D4906A";
    ctx.fillRect(hx, hy, 58, 45);
    ctx.fillStyle = "#A0712A";
    ctx.beginPath();
    ctx.moveTo(hx - 8, hy);
    ctx.lineTo(hx + 29, hy - 30);
    ctx.lineTo(hx + 66, hy);
    ctx.fill();
    ctx.fillStyle = "#5C3317";
    ctx.beginPath();
    ctx.roundRect(hx + 20, hy + 20, 18, 25, [5, 5, 0, 0]);
    ctx.fill();
  }

  // Title panel with texture
  ctx.fillStyle = "rgba(8,4,0,0.82)";
  ctx.beginPath();
  ctx.roundRect(cw * 0.08, ch * 0.56, cw * 0.84, ch * 0.38, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,165,0,0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner decorative border
  ctx.strokeStyle = "rgba(255,215,0,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cw * 0.1, ch * 0.58, cw * 0.8, ch * 0.34, 10);
  ctx.stroke();

  // OM symbol accent
  ctx.fillStyle = "rgba(255,165,0,0.18)";
  ctx.font = `${Math.min(60, cw * 0.1)}px serif`;
  ctx.textAlign = "center";
  ctx.fillText("ॐ", cw / 2, ch * 0.68);

  // Title
  ctx.fillStyle = "#FFD700";
  ctx.font = `bold ${Math.min(36, cw * 0.065)}px 'Bricolage Grotesque', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Indian Village Racer", cw / 2, ch * 0.65);

  // Subtitle
  ctx.fillStyle = "#FFA040";
  ctx.font = `${Math.min(15, cw * 0.028)}px 'Figtree', sans-serif`;
  ctx.fillText(
    "Dodge cows 🐄  autos 🛺  potholes  cyclists 🚴",
    cw / 2,
    ch * 0.73,
  );

  // Pulsing CTA
  const pulse = Math.sin(time / 25) * 0.28 + 0.72;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `${Math.min(15, cw * 0.028)}px 'Figtree', sans-serif`;
  ctx.fillText("Press SPACE · Tap to Start", cw / 2, ch * 0.84);
  ctx.globalAlpha = 1;
}

function drawGameOver(
  ctx: CanvasRenderingContext2D,
  gs: GameRef,
  time: number,
) {
  const { canvasW, canvasH, score, highScore } = gs;
  const isNewBest = Math.floor(score) >= Math.floor(highScore);

  ctx.fillStyle = "rgba(5,2,0,0.82)";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Panel
  ctx.fillStyle = "rgba(20,10,0,0.92)";
  ctx.beginPath();
  ctx.roundRect(
    canvasW * 0.12,
    canvasH * 0.22,
    canvasW * 0.76,
    canvasH * 0.52,
    16,
  );
  ctx.fill();
  ctx.strokeStyle = "rgba(255,140,0,0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#E8402A";
  ctx.font = `bold ${Math.min(42, canvasW * 0.085)}px 'Bricolage Grotesque', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GAME OVER", canvasW / 2, canvasH * 0.35);

  ctx.fillStyle = "#FFD700";
  ctx.font = `bold ${Math.min(26, canvasW * 0.052)}px 'Figtree', sans-serif`;
  ctx.fillText(`Score: ${Math.floor(score)}`, canvasW / 2, canvasH * 0.46);

  if (isNewBest) {
    const pulse = Math.sin(time / 18) * 0.2 + 0.8;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "#FFD700";
    ctx.font = `bold ${Math.min(18, canvasW * 0.036)}px 'Figtree', sans-serif`;
    ctx.fillText("🏆  New High Score!", canvasW / 2, canvasH * 0.56);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = "rgba(255,200,100,0.65)";
    ctx.font = `${Math.min(16, canvasW * 0.032)}px 'Figtree', sans-serif`;
    ctx.fillText(`Best: ${Math.floor(highScore)}`, canvasW / 2, canvasH * 0.56);
  }

  // Tap to play again hint
  const p2 = Math.sin(time / 22) * 0.25 + 0.65;
  ctx.globalAlpha = p2;
  ctx.fillStyle = "#FFA040";
  ctx.font = `${Math.min(14, canvasW * 0.028)}px 'Figtree', sans-serif`;
  ctx.fillText("Tap Play Again or press SPACE", canvasW / 2, canvasH * 0.65);
  ctx.globalAlpha = 1;
}

function spawnObstacle(gs: GameRef) {
  const types: ObstacleType[] = [
    "cow",
    "auto",
    "cyclist",
    "pothole",
    "pedestrian",
  ];
  const weights = [0.22, 0.2, 0.22, 0.22, 0.14];
  let r = Math.random();
  let type: ObstacleType = "pothole";
  for (let i = 0; i < types.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      type = types[i];
      break;
    }
  }
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const laneX = gs.lanePositions[lane];
  const sizes: Record<ObstacleType, [number, number]> = {
    cow: [52, 56],
    auto: [42, 62],
    cyclist: [32, 56],
    pothole: [52, 30],
    pedestrian: [28, 58],
  };
  const [w, h] = sizes[type];
  gs.obstacles.push({
    id: gs.obstacleIdCounter++,
    x: laneX,
    y: -h - 10,
    w,
    h,
    type,
  });
}

function checkCollision(gs: GameRef, obs: Obstacle): boolean {
  if (gs.invincible) return false;
  const margin = 0.65;
  const dx = Math.abs(gs.playerX - obs.x);
  const dy = Math.abs(gs.playerY - obs.y);
  const hitW = (gs.playerW * margin) / 2 + (obs.w * margin) / 2;
  const hitH = (gs.playerH * margin) / 2 + (obs.h * margin) / 2;
  return dx < hitW && dy < hitH;
}

function initLayout(canvas: HTMLCanvasElement, gs: GameRef) {
  const cw = canvas.width;
  const ch = canvas.height;
  const roadW = Math.min(cw * 0.54, 320);
  const roadX = (cw - roadW) / 2;
  const laneW = roadW / LANE_COUNT;
  gs.canvasW = cw;
  gs.canvasH = ch;
  gs.roadX = roadX;
  gs.roadW = roadW;
  gs.lanePositions = [
    roadX + laneW * 0.5,
    roadX + laneW * 1.5,
    roadX + laneW * 2.5,
  ];
  gs.playerY = ch * 0.78;
  gs.playerW = Math.max(26, laneW * 0.58);
  gs.playerH = gs.playerW * 1.72;
}

function initGame(
  canvas: HTMLCanvasElement,
  gs: GameRef,
  storedHighScore: number,
) {
  initLayout(canvas, gs);
  gs.speed = 3;
  gs.score = 0;
  gs.lives = 3;
  gs.invincible = false;
  gs.invincibleTimer = 0;
  gs.obstacles = [];
  gs.frameCount = 0;
  gs.nextObstacleIn = 90;
  gs.bgScrollY = 0;
  gs.obstacleIdCounter = 0;
  gs.currentLane = 1;
  gs.laneChangeCooldown = 0;
  gs.playerX = gs.lanePositions[1];
  gs.playerTargetX = gs.lanePositions[1];
  gs.highScore = storedHighScore;

  // Init background elements
  const bgTypes: BgType[] = ["palmtree", "palmtree", "hut", "bush", "crop"];
  gs.bgElements = [];
  for (let i = 0; i < 14; i++) {
    const side: "left" | "right" = Math.random() > 0.5 ? "left" : "right";
    gs.bgElements.push({
      x:
        side === "left"
          ? Math.random() * Math.max(1, gs.roadX - 25)
          : gs.roadX +
            gs.roadW +
            Math.random() * Math.max(1, gs.canvasW - gs.roadX - gs.roadW - 25),
      y: Math.random() * gs.canvasH,
      type: bgTypes[Math.floor(Math.random() * bgTypes.length)],
      side,
      scale: 0.65 + Math.random() * 0.65,
    });
  }
}

// ─── App Component ────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const frameCounterRef = useRef(0); // for start screen animation

  const gsRef = useRef<GameRef>({
    state: "start",
    playerX: 0,
    playerTargetX: 0,
    playerY: 0,
    playerW: 36,
    playerH: 62,
    speed: 3,
    score: 0,
    lives: 3,
    highScore: 0,
    invincible: false,
    invincibleTimer: 0,
    obstacles: [],
    bgElements: [],
    nextObstacleIn: 90,
    frameCount: 0,
    roadX: 0,
    roadW: 0,
    lanePositions: [0, 0, 0],
    currentLane: 1,
    canvasW: 0,
    canvasH: 0,
    obstacleIdCounter: 0,
    bgScrollY: 0,
    laneChangeCooldown: 0,
  });

  const [gameState, setGameState] = useState<GameState>("start");

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stored = Number.parseInt(
      localStorage.getItem("ivr_highscore") || "0",
    );
    initGame(canvas, gsRef.current, stored);
    gsRef.current.state = "playing";
    setGameState("playing");
  }, []);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gs = gsRef.current;
    frameCounterRef.current++;
    const fc = frameCounterRef.current;

    if (gs.state === "start") {
      drawStartScreen(ctx, canvas.width, canvas.height, fc);
      animFrameRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    if (gs.state === "gameover") {
      ctx.clearRect(0, 0, gs.canvasW, gs.canvasH);
      drawBackground(ctx, gs);
      for (const el of gs.bgElements) drawBgElement(ctx, el);
      for (const obs of gs.obstacles) drawObstacle(ctx, obs);
      drawPlayerCar(ctx, gs.playerX, gs.playerY, gs.playerW, gs.playerH, false);
      drawHUD(ctx, gs);
      drawGameOver(ctx, gs, fc);
      animFrameRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    // ── PLAYING ──────────────────────────────────────────────
    gs.frameCount++;
    gs.speed = Math.min(12, 3 + gs.frameCount * 0.0022);
    gs.score += gs.speed * 0.055;
    gs.bgScrollY += gs.speed * 0.75;

    // Scroll bg elements
    const bgTypes: BgType[] = ["palmtree", "palmtree", "hut", "bush", "crop"];
    for (const el of gs.bgElements) {
      el.y += gs.speed * 0.38;
      if (el.y > gs.canvasH + 90) {
        el.y = -90;
        const side: "left" | "right" = Math.random() > 0.5 ? "left" : "right";
        el.side = side;
        el.type = bgTypes[Math.floor(Math.random() * bgTypes.length)];
        el.x =
          side === "left"
            ? Math.random() * Math.max(1, gs.roadX - 25)
            : gs.roadX +
              gs.roadW +
              Math.random() *
                Math.max(1, gs.canvasW - gs.roadX - gs.roadW - 25);
        el.scale = 0.65 + Math.random() * 0.65;
      }
    }

    // Lane change cooldown
    if (gs.laneChangeCooldown > 0) gs.laneChangeCooldown--;

    // Keyboard input
    if (gs.laneChangeCooldown === 0) {
      const left =
        keysRef.current.has("ArrowLeft") ||
        keysRef.current.has("a") ||
        keysRef.current.has("A");
      const right =
        keysRef.current.has("ArrowRight") ||
        keysRef.current.has("d") ||
        keysRef.current.has("D");
      if (left && gs.currentLane > 0) {
        gs.currentLane--;
        gs.playerTargetX = gs.lanePositions[gs.currentLane];
        gs.laneChangeCooldown = 14;
      } else if (right && gs.currentLane < LANE_COUNT - 1) {
        gs.currentLane++;
        gs.playerTargetX = gs.lanePositions[gs.currentLane];
        gs.laneChangeCooldown = 14;
      }
    }

    // Smooth movement
    gs.playerX += (gs.playerTargetX - gs.playerX) * 0.16;

    // Spawn obstacles
    gs.nextObstacleIn--;
    if (gs.nextObstacleIn <= 0) {
      spawnObstacle(gs);
      const minGap = Math.max(28, 85 - gs.speed * 4.5);
      gs.nextObstacleIn = minGap + Math.random() * 45;
    }

    // Move obstacles
    for (const obs of gs.obstacles) {
      obs.y += gs.speed;
    }
    gs.obstacles = gs.obstacles.filter((obs) => obs.y < gs.canvasH + 100);

    // Collision
    if (!gs.invincible) {
      for (const obs of gs.obstacles) {
        if (checkCollision(gs, obs)) {
          gs.lives--;
          gs.invincible = true;
          gs.invincibleTimer = 110;
          if (gs.lives <= 0) {
            gs.lives = 0;
            gs.state = "gameover";
            const hs = Math.max(gs.highScore, Math.floor(gs.score));
            gs.highScore = hs;
            localStorage.setItem("ivr_highscore", String(hs));
            setGameState("gameover");
          }
          break;
        }
      }
    } else {
      gs.invincibleTimer--;
      if (gs.invincibleTimer <= 0) gs.invincible = false;
    }

    // Draw
    ctx.clearRect(0, 0, gs.canvasW, gs.canvasH);
    drawBackground(ctx, gs);
    for (const el of gs.bgElements) drawBgElement(ctx, el);
    for (const obs of gs.obstacles) drawObstacle(ctx, obs);
    const flash = gs.invincible && Math.floor(gs.invincibleTimer / 7) % 2 === 0;
    drawPlayerCar(ctx, gs.playerX, gs.playerY, gs.playerW, gs.playerH, flash);
    drawHUD(ctx, gs);

    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      if (gsRef.current.state === "playing") {
        initLayout(canvas, gsRef.current);
      }
    };
    resize();

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (gsRef.current.state !== "playing") startGame();
      }
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)
      ) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("resize", resize);

    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameLoop, startGame]);

  // Canvas tap to start
  const handleCanvasTap = useCallback(() => {
    if (gsRef.current.state !== "playing") startGame();
  }, [startGame]);

  // Touch controls
  const handleLeftPress = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      const gs = gsRef.current;
      if (gs.state !== "playing") return;
      if (gs.currentLane > 0 && gs.laneChangeCooldown === 0) {
        gs.currentLane--;
        gs.playerTargetX = gs.lanePositions[gs.currentLane];
        gs.laneChangeCooldown = 14;
      }
    },
    [],
  );

  const handleRightPress = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      const gs = gsRef.current;
      if (gs.state !== "playing") return;
      if (gs.currentLane < LANE_COUNT - 1 && gs.laneChangeCooldown === 0) {
        gs.currentLane++;
        gs.playerTargetX = gs.lanePositions[gs.currentLane];
        gs.laneChangeCooldown = 14;
      }
    },
    [],
  );

  return (
    <div className="game-wrapper">
      <div ref={containerRef} className="canvas-container">
        <canvas
          ref={canvasRef}
          data-ocid="game.canvas_target"
          className="game-canvas"
          onClick={handleCanvasTap}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleCanvasTap();
          }}
          onTouchEnd={handleCanvasTap}
        />
      </div>

      {/* Controls + action bar */}
      <div className="controls-bar" data-ocid="hud.panel">
        <button
          type="button"
          className="control-btn"
          data-ocid="controls.left_button"
          onTouchStart={handleLeftPress}
          onMouseDown={handleLeftPress}
          aria-label="Move left"
        >
          ◀
        </button>

        {(gameState === "start" || gameState === "gameover") && (
          <button
            type="button"
            className="play-btn"
            data-ocid="game.primary_button"
            onClick={startGame}
          >
            {gameState === "start" ? "🎮 Start Game" : "🔄 Play Again"}
          </button>
        )}

        {gameState === "playing" && (
          <div
            style={{
              flex: 1,
              textAlign: "center",
              color: "rgba(255,200,100,0.5)",
              fontSize: "12px",
              fontFamily: "Figtree, sans-serif",
            }}
          >
            ← → to dodge
          </div>
        )}

        <button
          type="button"
          className="control-btn"
          data-ocid="controls.right_button"
          onTouchStart={handleRightPress}
          onMouseDown={handleRightPress}
          aria-label="Move right"
        >
          ▶
        </button>
      </div>

      <footer className="game-footer">
        © {new Date().getFullYear()}. Built with ♥ using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
