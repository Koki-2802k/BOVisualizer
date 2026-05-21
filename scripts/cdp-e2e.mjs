#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = ensureTrailingSlash(process.env.E2E_BASE_URL ?? "http://127.0.0.1:5175/");
const CDP_URL = process.env.E2E_CDP_URL ?? "http://127.0.0.1:9222";
const OUT_DIR = path.resolve(process.env.E2E_OUT_DIR ?? "artifacts/e2e/cmd_405");
const WAIT_MS = Number(process.env.E2E_WAIT_MS ?? 60000);
const POLL_MS = Math.max(1000, Math.min(5000, Math.floor(WAIT_MS / 12) || 1000));
const VIEWPORTS = [
  [1920, 1080],
  [1366, 768],
];

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createCdpClient(wsUrl) {
  if (typeof WebSocket === "undefined") {
    throw new Error("global WebSocket is unavailable in this Node runtime");
  }

  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const events = [];

  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (typeof data.id === "number" && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) {
        reject(new Error(JSON.stringify(data.error)));
      } else {
        resolve(data.result ?? {});
      }
      return;
    }
    events.push(data);
  });

  const open = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("websocket connection failed")));
  });

  const send = async (method, params = {}) => {
    await open;
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };
  send.events = events;

  const close = () => {
    for (const { reject } of pending.values()) {
      reject(new Error("websocket closed"));
    }
    pending.clear();
    ws.close();
  };

  return { ws, send, close, events };
}

async function createPage() {
  const response = await fetch(`${CDP_URL}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  if (!response.ok) {
    throw new Error(`CDP target creation failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function evaluate(send, expression) {
  const response = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(`Runtime.evaluate failed: ${response.exceptionDetails.text ?? "unknown error"}`);
  }
  return response.result?.value;
}

async function waitForCondition(send, expression, { timeoutMs = 30000, intervalMs = 250, label = "condition" } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await evaluate(send, expression);
    if (lastValue) {
      return lastValue;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(lastValue)}`);
}

async function waitForPageReady(send) {
  return waitForCondition(
    send,
    `(() => {
      const button = Array.from(document.querySelectorAll("button")).find((el) => (el.textContent ?? "").includes("開始"));
      return Boolean(button) && document.querySelectorAll("canvas").length > 0;
    })()`,
    { timeoutMs: 30000, intervalMs: 500, label: "app readiness" },
  );
}

async function clickStart(send) {
  const result = await evaluate(
    send,
    `(() => {
      const button = Array.from(document.querySelectorAll("button")).find((el) => (el.textContent ?? "").includes("開始"));
      if (!button) {
        return { clicked: false, buttonText: null, frameReadout: document.querySelector(".frame-readout")?.textContent ?? "" };
      }
      button.click();
      return {
        clicked: true,
        buttonText: button.textContent ?? "",
        frameReadout: document.querySelector(".frame-readout")?.textContent ?? ""
      };
    })()`,
  );
  if (!result?.clicked) {
    throw new Error("開始 button was not found");
  }
  return result;
}

async function capturePageState(send) {
  return evaluate(
    send,
    `(() => {
      const frameReadout = document.querySelector(".frame-readout")?.textContent ?? "";
      const bodyText = document.body?.innerText ?? "";
      const canvasSummaries = Array.from(document.querySelectorAll("section[aria-label] canvas")).map((canvas) => {
        const rect = canvas.getBoundingClientRect();
        return {
          label: canvas.closest("section[aria-label]")?.getAttribute("aria-label") ?? "",
          cssWidth: Math.round(rect.width),
          cssHeight: Math.round(rect.height),
          pixelWidth: canvas.width,
          pixelHeight: canvas.height,
        };
      });

      const sampleCanvas = (selector) => {
        const wrapper = document.querySelector(selector);
        const canvas = wrapper?.querySelector("canvas");
        if (!wrapper || !canvas) {
          return { found: false, selector };
        }
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return {
            found: true,
            readable: false,
            selector,
            cssWidth: Math.round(rect.width),
            cssHeight: Math.round(rect.height),
            pixelWidth: canvas.width,
            pixelHeight: canvas.height,
          };
        }
        const width = Math.max(1, canvas.width);
        const height = Math.max(1, canvas.height);
        const data = ctx.getImageData(0, 0, width, height).data;
        const step = Math.max(4, Math.floor(Math.min(width, height) / 120));
        let sampled = 0;
        let nonWhite = 0;
        for (let y = 0; y < height; y += step) {
          for (let x = 0; x < width; x += step) {
            const index = (y * width + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const a = data[index + 3];
            sampled += 1;
            if (a !== 0 && !(r > 250 && g > 250 && b > 250)) {
              nonWhite += 1;
            }
          }
        }
        return {
          found: true,
          readable: true,
          selector,
          cssWidth: Math.round(rect.width),
          cssHeight: Math.round(rect.height),
          pixelWidth: canvas.width,
          pixelHeight: canvas.height,
          sampled,
          nonWhite,
        };
      };

      return {
        bodyText,
        frameReadout,
        dpr: window.devicePixelRatio || 1,
        canvasSummaries,
        oarCanvas: sampleCanvas('section[aria-label="オール軌跡"]'),
        timeSeriesCanvas: sampleCanvas('section[aria-label="時系列グラフ"]'),
      };
    })()`,
  );
}

function collectErrors(events) {
  return events
    .filter((event) => {
      if (event.method === "Runtime.exceptionThrown") {
        return true;
      }
      if (event.method === "Runtime.consoleAPICalled") {
        return ["error", "warning", "assert"].includes(event.params?.type);
      }
      if (event.method === "Log.entryAdded") {
        return ["error", "warning"].includes(event.params?.entry?.level);
      }
      return false;
    })
    .map((event) => ({
      method: event.method,
      type: event.params?.type ?? event.params?.entry?.level ?? "",
      text:
        event.params?.exceptionDetails?.text ??
        event.params?.entry?.text ??
        event.params?.args?.map((arg) => arg.value ?? arg.description).join(" ") ??
        "",
    }));
}

function verifyCanvas(state, width, height, label) {
  const canvas = state[label];
  if (!canvas?.found) {
    throw new Error(`${label} canvas not found`);
  }
  if (!canvas.readable) {
    throw new Error(`${label} canvas was not readable`);
  }
  if (canvas.cssWidth <= 0 || canvas.cssHeight <= 0) {
    throw new Error(`${label} canvas has invalid CSS size`);
  }
  if (canvas.pixelWidth <= 0 || canvas.pixelHeight <= 0) {
    throw new Error(`${label} canvas has invalid internal size`);
  }
  const expectedWidth = Math.round(canvas.cssWidth * state.dpr);
  const expectedHeight = Math.round(canvas.cssHeight * state.dpr);
  if (Math.abs(canvas.pixelWidth - expectedWidth) > 1 || Math.abs(canvas.pixelHeight - expectedHeight) > 1) {
    throw new Error(
      `${label} internal size mismatch: css=${canvas.cssWidth}x${canvas.cssHeight}, dpr=${state.dpr}, internal=${canvas.pixelWidth}x${canvas.pixelHeight}`,
    );
  }
  if (canvas.nonWhite < 25) {
    throw new Error(`${label} canvas appears blank: nonWhite=${canvas.nonWhite}, sampled=${canvas.sampled}`);
  }
  return {
    viewport: { width, height },
    selector: canvas.selector,
    cssSize: { width: canvas.cssWidth, height: canvas.cssHeight },
    pixelSize: { width: canvas.pixelWidth, height: canvas.pixelHeight },
    sampled: canvas.sampled,
    nonWhite: canvas.nonWhite,
  };
}

async function runViewport(send, width, height) {
  send.events.length = 0;
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: BASE_URL });
  await waitForPageReady(send);

  const initialState = await capturePageState(send);
  const clicked = await clickStart(send);

  const progressionSamples = [{ atMs: 0, frameReadout: clicked.frameReadout, bodyText: initialState.bodyText.slice(0, 500) }];
  const deadline = Date.now() + WAIT_MS;
  let progressed = false;
  let finalState = null;

  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    await sleep(Math.min(POLL_MS, remaining));
    const sample = await capturePageState(send);
    progressionSamples.push({
      atMs: WAIT_MS - Math.max(0, deadline - Date.now()),
      frameReadout: sample.frameReadout,
      bodyText: sample.bodyText.slice(0, 500),
    });
    if (sample.frameReadout !== clicked.frameReadout) {
      progressed = true;
    }
    finalState = sample;
  }

  if (!finalState) {
    finalState = await capturePageState(send);
  }

  const errors = collectErrors(send.events);
  const oarCanvas = verifyCanvas(finalState, width, height, "oarCanvas");
  const timeSeriesCanvas = verifyCanvas(finalState, width, height, "timeSeriesCanvas");

  if (!progressed) {
    throw new Error(`Frame progression was not observed for viewport ${width}x${height}`);
  }
  if (errors.length > 0) {
    throw new Error(`Console or runtime errors detected: ${JSON.stringify(errors, null, 2)}`);
  }

  const screenshotPath = path.join(OUT_DIR, `${width}x${height}.png`);
  const screenshot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

  return {
    viewport: { width, height },
    initialState: {
      frameReadout: initialState.frameReadout,
      bodyText: initialState.bodyText.slice(0, 500),
      canvasSummaries: initialState.canvasSummaries,
    },
    finalState: {
      frameReadout: finalState.frameReadout,
      bodyText: finalState.bodyText.slice(0, 500),
      canvasSummaries: finalState.canvasSummaries,
    },
    progressionSamples,
    canvasChecks: {
      oarCanvas,
      timeSeriesCanvas,
    },
    screenshotPath,
    errors,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const page = await createPage();
  const client = createCdpClient(page.webSocketDebuggerUrl);

  try {
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await client.send("Log.enable");

    const results = [];
    for (const [width, height] of VIEWPORTS) {
      results.push(await runViewport(client.send, width, height));
    }

    const payload = {
      ok: true,
      baseUrl: BASE_URL,
      cdpUrl: CDP_URL,
      waitMs: WAIT_MS,
      outDir: OUT_DIR,
      results,
    };
    await writeFile(path.join(OUT_DIR, "result.json"), `${JSON.stringify(payload, null, 2)}\n`);
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
