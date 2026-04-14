import fs from "node:fs";
import path from "node:path";
import PImage from "pureimage";

const root = process.cwd();
const outDir = path.join(root, "assets", "sprites");

fs.mkdirSync(outDir, { recursive: true });

function makeCanvas(size = 96) {
  const image = PImage.make(size, size);
  const ctx = image.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  return { image, ctx, size };
}

function circle(ctx, x, y, r, fill, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function ellipse(ctx, x, y, rx, ry, fill, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function polygon(ctx, points, fill, stroke = null, lineWidth = 2, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function line(ctx, points, stroke, lineWidth = 2, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.stroke();
  ctx.restore();
}

async function save(image, name) {
  const target = path.join(outDir, name);
  await PImage.encodePNGToStream(image, fs.createWriteStream(target));
}

async function makePlayer() {
  const { image, ctx } = makeCanvas(104);
  ellipse(ctx, 52, 59, 36, 14, "#63f5c8", 0.12);
  ellipse(ctx, 52, 54, 31, 11, "#7cecff", 0.22);
  ellipse(ctx, 52, 58, 27, 11, "#7deee1", 0.98);
  ellipse(ctx, 52, 48, 16, 12, "#c6fbff", 0.96);
  ellipse(ctx, 52, 50, 11, 8, "#8de7ff", 0.92);
  circle(ctx, 52, 46, 4, "#ffffff", 0.95);
  circle(ctx, 33, 58, 3, "#f8ffb7", 0.95);
  circle(ctx, 52, 62, 3, "#f8ffb7", 0.95);
  circle(ctx, 71, 58, 3, "#f8ffb7", 0.95);
  polygon(
    ctx,
    [
      [83, 58],
      [94, 52],
      [94, 64],
    ],
    "#efffff",
    "#ffffff",
    1.6
  );
  line(ctx, [[20, 58], [10, 58]], "#ffb86b", 6, 0.6);
  line(ctx, [[19, 58], [7, 58]], "#ff6d4d", 2, 0.82);
  await save(image, "player-ship.png");
}

async function makeDrifter() {
  const { image, ctx } = makeCanvas(96);
  circle(ctx, 48, 46, 26, "#ff7d8e", 0.08);
  ellipse(ctx, 48, 44, 15, 18, "#ff8ea4", 0.97);
  ellipse(ctx, 48, 44, 9, 12, "#fff4f7", 0.95);
  circle(ctx, 48, 44, 4, "#ff7d8e", 0.9);
  line(ctx, [[36, 56], [29, 74]], "#ffb8c9", 3, 0.82);
  line(ctx, [[48, 58], [48, 78]], "#ffb8c9", 3, 0.82);
  line(ctx, [[60, 56], [67, 74]], "#ffb8c9", 3, 0.82);
  line(ctx, [[42, 57], [39, 71]], "#ffd8e0", 1.5, 0.75);
  line(ctx, [[54, 57], [57, 71]], "#ffd8e0", 1.5, 0.75);
  circle(ctx, 36, 41, 3, "#fff0f4", 0.95);
  circle(ctx, 60, 41, 3, "#fff0f4", 0.95);
  await save(image, "enemy-drifter.png");
}

async function makeRush() {
  const { image, ctx } = makeCanvas(96);
  circle(ctx, 48, 48, 28, "#ffb86b", 0.08);
  polygon(
    ctx,
    [
      [18, 48],
      [40, 30],
      [64, 34],
      [80, 48],
      [64, 62],
      [40, 66],
    ],
    "#ffb86b",
    "#fff1da",
    2
  );
  polygon(
    ctx,
    [
      [42, 39],
      [56, 39],
      [62, 48],
      [56, 57],
      [42, 57],
      [36, 48],
    ],
    "#fff0b4",
    null,
    1
  );
  line(ctx, [[22, 42], [12, 28]], "#ffe3a8", 2.8, 0.72);
  line(ctx, [[22, 54], [12, 68]], "#ffe3a8", 2.8, 0.72);
  line(ctx, [[69, 39], [82, 28]], "#ffe3a8", 2.6, 0.72);
  line(ctx, [[69, 57], [82, 68]], "#ffe3a8", 2.6, 0.72);
  circle(ctx, 45, 48, 2.4, "#ff8e6c", 0.96);
  circle(ctx, 53, 48, 2.4, "#ff8e6c", 0.96);
  await save(image, "enemy-rush.png");
}

async function makeBrute() {
  const { image, ctx } = makeCanvas(116);
  circle(ctx, 58, 58, 36, "#9d85ff", 0.08);
  polygon(
    ctx,
    [
      [35, 36],
      [58, 21],
      [81, 36],
      [88, 58],
      [81, 82],
      [58, 95],
      [35, 82],
      [28, 58],
    ],
    "#8f79ef",
    "#e9deff",
    3
  );
  polygon(
    ctx,
    [
      [42, 43],
      [58, 33],
      [74, 43],
      [79, 58],
      [74, 73],
      [58, 81],
      [42, 73],
      [37, 58],
    ],
    "#cdbfff",
    null,
    1
  );
  polygon(
    ctx,
    [
      [25, 51],
      [9, 42],
      [13, 60],
      [8, 75],
      [28, 67],
    ],
    "#bba8ff",
    "#efe7ff",
    2
  );
  polygon(
    ctx,
    [
      [91, 51],
      [107, 42],
      [103, 60],
      [108, 75],
      [88, 67],
    ],
    "#bba8ff",
    "#efe7ff",
    2
  );
  circle(ctx, 51, 58, 4, "#ffffff", 0.96);
  circle(ctx, 65, 58, 4, "#ffffff", 0.96);
  circle(ctx, 58, 66, 3, "#f2ebff", 0.92);
  await save(image, "enemy-brute.png");
}

async function makeShade() {
  const { image, ctx } = makeCanvas(100);
  circle(ctx, 50, 46, 30, "#69d7ff", 0.08);
  polygon(
    ctx,
    [
      [50, 18],
      [73, 34],
      [69, 57],
      [50, 68],
      [31, 57],
      [27, 34],
    ],
    "#70dcff",
    "#f0feff",
    2
  );
  ellipse(ctx, 50, 43, 12, 9, "#efffff", 0.92);
  circle(ctx, 50, 43, 4, "#71d9ff", 0.95);
  line(ctx, [[41, 63], [35, 82]], "#9fe8ff", 3, 0.78);
  line(ctx, [[50, 66], [50, 86]], "#9fe8ff", 3, 0.78);
  line(ctx, [[59, 63], [65, 82]], "#9fe8ff", 3, 0.78);
  line(ctx, [[33, 39], [18, 33]], "#a5efff", 2, 0.7);
  line(ctx, [[67, 39], [82, 33]], "#a5efff", 2, 0.7);
  await save(image, "enemy-shade.png");
}

async function makeOrb() {
  const { image, ctx } = makeCanvas(48);
  circle(ctx, 24, 24, 18, "#63f5c8", 0.16);
  polygon(
    ctx,
    [
      [24, 8],
      [38, 24],
      [24, 40],
      [10, 24],
    ],
    "#63f5c8",
    "#e9fffb",
    2
  );
  polygon(
    ctx,
    [
      [24, 14],
      [32, 24],
      [24, 34],
      [16, 24],
    ],
    "#d7fff5",
    null,
    1
  );
  await save(image, "xp-orb.png");
}

async function makeBullet() {
  const { image, ctx } = makeCanvas(40);
  line(ctx, [[10, 20], [29, 20]], "#8de7ff", 8, 0.8);
  line(ctx, [[10, 20], [31, 20]], "#ffffff", 3, 0.95);
  polygon(
    ctx,
    [
      [30, 14],
      [37, 20],
      [30, 26],
    ],
    "#dffcff",
    null,
    1
  );
  await save(image, "bullet.png");
}

await Promise.all([
  makePlayer(),
  makeDrifter(),
  makeRush(),
  makeBrute(),
  makeShade(),
  makeOrb(),
  makeBullet(),
]);

console.log(`Generated sprite assets in ${outDir}`);
