const WIDTH = 390;
const MAX_MESSAGES = 5;
const MAX_AVATAR_BYTES = 1_500_000;
const AVATAR_ROOT = "https://raw.githubusercontent.com/sangha0712/crack-first-SVG/main/";
const AVATAR_REV = "1";
const DEFAULT_AVATAR_BY_NAME = { "하린": "hr" };

export default {
  async fetch(request) {
    if (request.method !== "GET") {
      return new Response("GET only", { status: 405 });
    }

    const url = new URL(request.url);
    const app = value(url, "app", "kakao").toLowerCase();
    const name = value(url, "name", "하린").slice(0, 20);
    const status = value(url, "status", app === "instagram" ? "활동 중" : "").slice(0, 30);
    const date = value(url, "date", "오늘").slice(0, 20);
    const avatarKey = validAvatarKey(url.searchParams.get("a") || url.searchParams.get("avatar"))
      || DEFAULT_AVATAR_BY_NAME[name]
      || "";
    const avatarData = await loadAvatar(avatarKey);
    const messages = [];

    for (let i = 1; i <= MAX_MESSAGES; i += 1) {
      const text = value(url, `m${i}`, "").slice(0, 180);
      if (!text) continue;
      messages.push({
        side: value(url, `s${i}`, i % 2 ? "them" : "me") === "me" ? "me" : "them",
        text,
        time: value(url, `t${i}`, "").slice(0, 20),
      });
    }

    if (!messages.length) {
      messages.push(
        { side: "them", text: "지금 어디야?", time: "오후 8:14" },
        { side: "me", text: "곧 도착해", time: "오후 8:15" },
      );
    }

    const svg = app === "instagram"
      ? renderInstagram({ name, status, date, messages, avatarData })
      : renderKakao({ name, date, messages, avatarData });

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};

function value(url, key, fallback) {
  const raw = url.searchParams.get(key);
  if (raw === null || raw === "") return fallback;
  return decodeTokens(raw);
}

function validAvatarKey(raw) {
  if (!raw) return "";
  const key = raw.trim().replace(/\.webp$/i, "");
  return /^[a-z0-9][a-z0-9_-]{0,31}$/i.test(key) ? key : "";
}

async function loadAvatar(key) {
  if (!key) return "";

  try {
    const response = await fetch(`${AVATAR_ROOT}${encodeURIComponent(key)}.webp?v=${AVATAR_REV}`, {
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: {
          "200-299": 86400,
          "404": 60,
          "500-599": 0,
        },
      },
    });
    if (!response.ok) return "";

    const type = (response.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
    if (!["image/png", "image/jpeg", "image/webp"].includes(type)) return "";

    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength > MAX_AVATAR_BYTES) return "";
    return `data:${type};base64,${bytesToBase64(new Uint8Array(buffer))}`;
  } catch {
    return "";
  }
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function decodeTokens(text) {
  return text
    .replace(/_/g, " ")
    .replace(/~s/g, " ")
    .replace(/~a/g, "&")
    .replace(/~q/g, "?")
    .replace(/~h/g, "#")
    .replace(/~e/g, "=")
    .replace(/~p/g, "%")
    .replace(/~l/g, "(")
    .replace(/~r/g, ")")
    .replace(/~u/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
}

function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function charWidth(char) {
  if (/\s/.test(char)) return 4.5;
  if (/[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af]/u.test(char)) return 14.5;
  if (/\p{Extended_Pictographic}/u.test(char)) return 16;
  if (/[A-ZMW@#%&]/.test(char)) return 9.2;
  return 7.7;
}

function visualWidth(text) {
  return Array.from(text).reduce((sum, char) => sum + charWidth(char), 0);
}

function wrap(text, maxWidth) {
  const lines = [];
  let line = "";
  let width = 0;

  for (const char of Array.from(text)) {
    if (char === "\n") {
      lines.push(line || " ");
      line = "";
      width = 0;
      continue;
    }
    const nextWidth = charWidth(char);
    if (line && width + nextWidth > maxWidth) {
      lines.push(line);
      line = char;
      width = nextWidth;
    } else {
      line += char;
      width += nextWidth;
    }
  }
  if (line || !lines.length) lines.push(line || " ");
  return lines.slice(0, 6);
}

function tspans(lines, x, y, color = "#191919", weight = 400) {
  return `<text x="${x}" y="${y}" fill="${color}" font-size="15" font-weight="${weight}" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${lines
    .map((line, index) => `<tspan x="${x}" dy="${index ? 22 : 0}">${esc(line)}</tspan>`)
    .join("")}</text>`;
}

function initial(name) {
  return esc(Array.from(name.trim())[0] || "?");
}

function avatarImage(data, cx, cy, radius) {
  const size = radius * 2;
  return `<image href="${data}" x="${cx - radius}" y="${cy - radius}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`;
}

function baseSvg(height, background, body, defs = "") {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="메신저 대화 화면">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.4" flood-opacity="0.14"/>
    </filter>
    <clipPath id="avatarClip" clipPathUnits="objectBoundingBox">
      <circle cx="0.5" cy="0.5" r="0.5"/>
    </clipPath>
    ${defs}
  </defs>
  <rect width="${WIDTH}" height="${height}" fill="${background}"/>
  ${body}
</svg>`;
}

function renderKakao({ name, date, messages, avatarData }) {
  let y = 108;
  const parts = [
    `<rect width="390" height="68" fill="#ffffff"/>`,
    `<path d="M25 34l10-10m-10 10 10 10" fill="none" stroke="#202020" stroke-width="2.2" stroke-linecap="round"/>`,
    `<text x="195" y="31" text-anchor="middle" fill="#151515" font-size="16" font-weight="700" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(name)}</text>`,
    `<text x="195" y="49" text-anchor="middle" fill="#8a8a8a" font-size="11" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">1:1 채팅</text>`,
    `<circle cx="354" cy="29" r="2" fill="#333"/><circle cx="354" cy="36" r="2" fill="#333"/><circle cx="354" cy="43" r="2" fill="#333"/>`,
    `<rect x="166" y="79" width="58" height="24" rx="12" fill="#8ea4b6" fill-opacity="0.72"/>`,
    `<text x="195" y="95" text-anchor="middle" fill="#fff" font-size="11" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(date)}</text>`,
  ];

  for (const message of messages) {
    const lines = wrap(message.text, 250);
    const textWidth = Math.max(...lines.map(visualWidth));
    const bubbleWidth = Math.min(286, Math.max(48, textWidth + 28));
    const bubbleHeight = lines.length * 22 + 18;
    const mine = message.side === "me";
    const bubbleX = mine ? WIDTH - 18 - bubbleWidth : 58;

    if (!mine) {
      parts.push(
        `<circle cx="32" cy="${y + 18}" r="18" fill="#f3f3f3" filter="url(#shadow)"/>`,
        avatarData
          ? avatarImage(avatarData, 32, y + 18, 18)
          : `<text x="32" y="${y + 23}" text-anchor="middle" fill="#616161" font-size="14" font-weight="700" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${initial(name)}</text>`,
        `<text x="58" y="${y - 7}" fill="#4b5660" font-size="11" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(name)}</text>`,
      );
    }

    parts.push(`<rect x="${bubbleX}" y="${y}" width="${bubbleWidth}" height="${bubbleHeight}" rx="11" fill="${mine ? "#FEE500" : "#ffffff"}"/>`);
    parts.push(tspans(lines, bubbleX + 14, y + 24));

    if (message.time) {
      const timeX = mine ? bubbleX - 7 : bubbleX + bubbleWidth + 7;
      const anchor = mine ? "end" : "start";
      parts.push(`<text x="${timeX}" y="${y + bubbleHeight - 4}" text-anchor="${anchor}" fill="#617485" font-size="10" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(message.time)}</text>`);
    }
    y += bubbleHeight + (mine ? 15 : 34);
  }

  const height = Math.max(430, y + 30);
  return baseSvg(height, "#B2C7D9", parts.join("\n  "));
}

function renderInstagram({ name, status, date, messages, avatarData }) {
  let y = 126;
  const gradient = `<linearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FFD600"/><stop offset="0.45" stop-color="#FF3B30"/><stop offset="1" stop-color="#C13584"/></linearGradient>`;
  const parts = [
    `<rect width="390" height="78" fill="#ffffff"/>`,
    `<path d="M24 39l10-10m-10 10 10 10" fill="none" stroke="#171717" stroke-width="2.2" stroke-linecap="round"/>`,
    `<circle cx="66" cy="39" r="23" fill="none" stroke="url(#ig)" stroke-width="2.5"/>`,
    `<circle cx="66" cy="39" r="19" fill="#f0f0f0"/>`,
    avatarData
      ? avatarImage(avatarData, 66, 39, 19)
      : `<text x="66" y="44" text-anchor="middle" fill="#555" font-size="14" font-weight="700" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${initial(name)}</text>`,
    `<text x="99" y="35" fill="#111" font-size="14" font-weight="700" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(name)}</text>`,
    `<text x="99" y="53" fill="#8e8e8e" font-size="11" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(status)}</text>`,
    `<path d="M322 31a11 11 0 1 0 0 16a11 11 0 1 0 0-16m17 2l11-6v24l-11-6z" fill="none" stroke="#202020" stroke-width="1.8" stroke-linejoin="round"/>`,
    `<line x1="0" y1="78" x2="390" y2="78" stroke="#efefef"/>`,
    `<text x="195" y="103" text-anchor="middle" fill="#9a9a9a" font-size="11" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(date)}</text>`,
  ];

  for (const message of messages) {
    const lines = wrap(message.text, 252);
    const textWidth = Math.max(...lines.map(visualWidth));
    const bubbleWidth = Math.min(292, Math.max(52, textWidth + 30));
    const bubbleHeight = lines.length * 22 + 18;
    const mine = message.side === "me";
    const bubbleX = mine ? WIDTH - 18 - bubbleWidth : 54;

    if (!mine) {
      parts.push(
        `<circle cx="29" cy="${y + bubbleHeight / 2}" r="17" fill="none" stroke="url(#ig)" stroke-width="2"/>`,
        `<circle cx="29" cy="${y + bubbleHeight / 2}" r="13.5" fill="#f0f0f0"/>`,
        avatarData
          ? avatarImage(avatarData, 29, y + bubbleHeight / 2, 13.5)
          : `<text x="29" y="${y + bubbleHeight / 2 + 5}" text-anchor="middle" fill="#555" font-size="11" font-weight="700" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${initial(name)}</text>`,
      );
    }

    parts.push(`<rect x="${bubbleX}" y="${y}" width="${bubbleWidth}" height="${bubbleHeight}" rx="${bubbleHeight / 2}" fill="${mine ? "#3797F0" : "#efefef"}"/>`);
    parts.push(tspans(lines, bubbleX + 15, y + 24, mine ? "#ffffff" : "#161616"));

    if (message.time) {
      parts.push(`<text x="${mine ? bubbleX + bubbleWidth : bubbleX}" y="${y + bubbleHeight + 14}" text-anchor="${mine ? "end" : "start"}" fill="#a0a0a0" font-size="10" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(message.time)}</text>`);
      y += 14;
    }
    y += bubbleHeight + 13;
  }

  const height = Math.max(430, y + 30);
  return baseSvg(height, "#ffffff", parts.join("\n  "), gradient);
}
