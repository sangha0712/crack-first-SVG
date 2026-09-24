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
    const name = value(url, "name", "하린").slice(0, 20);
    const status = value(url, "status", "활동 중").slice(0, 30);
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

    const svg = renderInstagram({ name, status, date, messages, avatarData });

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
  let y = 118;
  const parts = [
    `<rect width="390" height="64" fill="#ffffff"/>`,
    `<line x1="0" y1="63.5" x2="390" y2="63.5" stroke="#ececec" stroke-width="1"/>`,
    `<path d="M29 23L20 32l9 9" fill="none" stroke="#191919" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<text x="195" y="38" text-anchor="middle" fill="#151515" font-size="17" font-weight="700" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(name)}</text>`,
    `<circle cx="320" cy="31" r="7.3" fill="none" stroke="#232323" stroke-width="1.8"/>`,
    `<line x1="325.5" y1="36.5" x2="331" y2="42" stroke="#232323" stroke-width="1.8" stroke-linecap="round"/>`,
    `<line x1="351" y1="25" x2="365" y2="25" stroke="#232323" stroke-width="2" stroke-linecap="round"/>`,
    `<line x1="351" y1="32" x2="365" y2="32" stroke="#232323" stroke-width="2" stroke-linecap="round"/>`,
    `<line x1="351" y1="39" x2="365" y2="39" stroke="#232323" stroke-width="2" stroke-linecap="round"/>`,
    `<rect x="159" y="77" width="72" height="24" rx="12" fill="#93A9BB" fill-opacity="0.72"/>`,
    `<text x="195" y="93.5" text-anchor="middle" fill="#ffffff" font-size="11" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(date)}</text>`,
  ];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const groupStart = !previous || previous.side !== message.side;
    const groupEnd = !next || next.side !== message.side;
    const lines = wrap(message.text, 232);
    const textWidth = Math.max(...lines.map(visualWidth));
    const bubbleWidth = Math.min(270, Math.max(50, textWidth + 26));
    const bubbleHeight = lines.length * 22 + 16;
    const mine = message.side === "me";
    const bubbleX = mine ? WIDTH - 18 - bubbleWidth : 58;

    if (!mine && groupStart) {
      parts.push(
        `<circle cx="31" cy="${y + 18}" r="19" fill="#f3f3f3" filter="url(#shadow)"/>`,
        avatarData
          ? avatarImage(avatarData, 31, y + 18, 19)
          : `<text x="31" y="${y + 23}" text-anchor="middle" fill="#616161" font-size="14" font-weight="700" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${initial(name)}</text>`,
        `<text x="58" y="${y - 7}" fill="#4A5965" font-size="11.5" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(name)}</text>`,
      );
    }

    if (groupStart) {
      const edge = mine ? bubbleX + bubbleWidth : bubbleX;
      const tail = mine
        ? `M${edge - 1} ${y + 8}L${edge + 8} ${y + 12}L${edge - 1} ${y + 19}Z`
        : `M${edge + 1} ${y + 8}L${edge - 8} ${y + 12}L${edge + 1} ${y + 19}Z`;
      parts.push(`<path d="${tail}" fill="${mine ? "#FEE500" : "#ffffff"}"/>`);
    }

    parts.push(`<rect x="${bubbleX}" y="${y}" width="${bubbleWidth}" height="${bubbleHeight}" rx="8" fill="${mine ? "#FEE500" : "#ffffff"}"/>`);
    parts.push(tspans(lines, bubbleX + 13, y + 23));

    if (message.time) {
      const timeX = mine ? bubbleX - 6 : bubbleX + bubbleWidth + 6;
      const anchor = mine ? "end" : "start";
      parts.push(`<text x="${timeX}" y="${y + bubbleHeight - 2}" text-anchor="${anchor}" fill="#5E7180" font-size="9.5" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(message.time)}</text>`);
    }
    y += bubbleHeight + (groupEnd ? 23 : 6);
  }

  const height = Math.max(540, y + 92);
  const inputY = height - 58;
  parts.push(
    `<rect x="0" y="${inputY}" width="390" height="58" fill="#ffffff"/>`,
    `<line x1="0" y1="${inputY}" x2="390" y2="${inputY}" stroke="#e9e9e9"/>`,
    `<circle cx="25" cy="${inputY + 29}" r="13" fill="#ffffff" stroke="#9b9b9b" stroke-width="1.4"/>`,
    `<line x1="19" y1="${inputY + 29}" x2="31" y2="${inputY + 29}" stroke="#7f7f7f" stroke-width="1.5" stroke-linecap="round"/>`,
    `<line x1="25" y1="${inputY + 23}" x2="25" y2="${inputY + 35}" stroke="#7f7f7f" stroke-width="1.5" stroke-linecap="round"/>`,
    `<rect x="48" y="${inputY + 9}" width="324" height="40" rx="20" fill="#f5f5f5"/>`,
    `<text x="65" y="${inputY + 34}" fill="#a4a4a4" font-size="13" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">메시지 입력</text>`,
    `<circle cx="326" cy="${inputY + 29}" r="9" fill="none" stroke="#8e8e8e" stroke-width="1.4"/>`,
    `<circle cx="323" cy="${inputY + 27}" r="1" fill="#8e8e8e"/><circle cx="329" cy="${inputY + 27}" r="1" fill="#8e8e8e"/>`,
    `<path d="M322 ${inputY + 32}q4 4 8 0" fill="none" stroke="#8e8e8e" stroke-width="1.2" stroke-linecap="round"/>`,
    `<text x="352" y="${inputY + 34}" text-anchor="middle" fill="#8e8e8e" font-size="18" font-weight="500" font-family="system-ui,-apple-system,sans-serif">#</text>`,
  );

  return baseSvg(height, "#B2C7D9", parts.join("\n  "));
}

function renderInstagram({ name, status, date, messages, avatarData }) {
  let y = 124;
  const gradient = `
    <linearGradient id="ig" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#FFD600"/>
      <stop offset="0.42" stop-color="#FF3040"/>
      <stop offset="1" stop-color="#C13584"/>
    </linearGradient>
    <linearGradient id="sent" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#5B51D8"/>
      <stop offset="0.55" stop-color="#833AB4"/>
      <stop offset="1" stop-color="#C13584"/>
    </linearGradient>`;
  const parts = [
    `<rect width="390" height="72" fill="#ffffff"/>`,
    `<path d="M29 27L20 36l9 9" fill="none" stroke="#111111" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="61" cy="36" r="22" fill="none" stroke="url(#ig)" stroke-width="2.2"/>`,
    `<circle cx="61" cy="36" r="18.5" fill="#f1f1f1"/>`,
    avatarData
      ? avatarImage(avatarData, 61, 36, 18.5)
      : `<text x="61" y="41" text-anchor="middle" fill="#555" font-size="13" font-weight="700" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${initial(name)}</text>`,
    `<text x="91" y="32" fill="#111111" font-size="14.5" font-weight="700" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(name)}</text>`,
    `<text x="91" y="50" fill="#8e8e8e" font-size="10.5" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(status)}</text>`,
    `<path d="M305 29c2-3 5-4 8-2l4 4c1 1 1 3 0 4l-3 3c3 5 6 8 11 11l3-3c1-1 3-1 4 0l4 4c2 2 1 6-2 8l-2 1c-4 2-14-3-22-11s-13-18-11-22z" fill="none" stroke="#151515" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" transform="scale(.72) translate(120 12)"/>`,
    `<rect x="342" y="27" width="22" height="18" rx="5" fill="none" stroke="#151515" stroke-width="1.8"/>`,
    `<path d="M364 32l8-5v18l-8-5z" fill="none" stroke="#151515" stroke-width="1.8" stroke-linejoin="round"/>`,
    `<line x1="0" y1="71.5" x2="390" y2="71.5" stroke="#ededed"/>`,
    `<text x="195" y="101" text-anchor="middle" fill="#9b9b9b" font-size="10.5" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(date)}</text>`,
  ];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const groupStart = !previous || previous.side !== message.side;
    const groupEnd = !next || next.side !== message.side;
    const isLast = index === messages.length - 1;
    const lines = wrap(message.text, 246);
    const textWidth = Math.max(...lines.map(visualWidth));
    const bubbleWidth = Math.min(286, Math.max(52, textWidth + 30));
    const bubbleHeight = lines.length * 22 + 16;
    const mine = message.side === "me";
    const bubbleX = mine ? WIDTH - 14 - bubbleWidth : 52;

    if (!mine && groupEnd) {
      parts.push(
        `<circle cx="27" cy="${y + bubbleHeight - 15}" r="15.5" fill="none" stroke="url(#ig)" stroke-width="1.8"/>`,
        `<circle cx="27" cy="${y + bubbleHeight - 15}" r="12.5" fill="#f0f0f0"/>`,
        avatarData
          ? avatarImage(avatarData, 27, y + bubbleHeight - 15, 12.5)
          : `<text x="27" y="${y + bubbleHeight - 11}" text-anchor="middle" fill="#555" font-size="10" font-weight="700" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${initial(name)}</text>`,
      );
    }

    const radius = Math.min(20, bubbleHeight / 2);
    parts.push(`<rect x="${bubbleX}" y="${y}" width="${bubbleWidth}" height="${bubbleHeight}" rx="${radius}" fill="${mine ? "url(#sent)" : "#EFEFEF"}"/>`);
    parts.push(tspans(lines, bubbleX + 15, y + 23, mine ? "#ffffff" : "#171717"));

    if (groupEnd && (message.time || (mine && isLast))) {
      const meta = mine && isLast
        ? `${message.time ? `${message.time} · ` : ""}읽음`
        : message.time;
      parts.push(`<text x="${mine ? bubbleX + bubbleWidth : bubbleX}" y="${y + bubbleHeight + 13}" text-anchor="${mine ? "end" : "start"}" fill="#9a9a9a" font-size="9.5" font-family="system-ui,-apple-system,'Noto Sans KR',sans-serif">${esc(meta)}</text>`);
      y += 13;
    }
    y += bubbleHeight + (groupEnd ? 15 : 5);
  }

  const height = Math.max(184, y + 4);
  parts.push(`<line x1="0" y1="${height - 0.5}" x2="390" y2="${height - 0.5}" stroke="#eeeeee"/>`);

  return baseSvg(height, "#ffffff", parts.join("\n  "), gradient);
}
