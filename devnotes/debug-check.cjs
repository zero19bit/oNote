// DevTools probe — connect to the running Tauri webview via the
// Chrome DevTools Protocol and dump console output + DOM state.
const wsUrl = process.argv[2];
if (!wsUrl) {
  console.error("usage: node debug-check.cjs <wsUrl>");
  process.exit(1);
}

const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const myId = ++id;
    pending.set(myId, { resolve, reject });
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
}

ws.addEventListener("open", async () => {
  try {
    // Enable Runtime so we get console events
    await send("Runtime.enable");
    await send("Log.enable");
    await send("Network.enable");
    await send("Page.enable");
    // Wait a bit for any pending console messages
    await new Promise((r) => setTimeout(r, 1500));
    // Evaluate diagnostic JS
    const res = await send("Runtime.evaluate", {
      expression: `
        JSON.stringify({
          hasRoot: !!document.getElementById('root'),
          rootChildren: document.getElementById('root')?.children?.length ?? -1,
          rootInnerHTMLLen: document.getElementById('root')?.innerHTML?.length ?? 0,
          rootInnerHTMLStart: (document.getElementById('root')?.innerHTML ?? '').slice(0, 500),
          bootVisible: !document.getElementById('onote-boot')?.classList?.contains('hidden'),
          bootText: document.getElementById('onote-boot')?.textContent,
          bodyHTMLStart: document.body.innerHTML.slice(0, 500),
          url: location.href,
        });
      `,
      returnByValue: true,
    });
    console.log("---DIAG---");
    console.log(res.result?.result?.value || JSON.stringify(res));
  } catch (e) {
    console.error("probe failed", e);
  } finally {
    ws.close();
  }
});

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
    return;
  }
  if (msg.method === "Runtime.consoleAPICalled") {
    const args = (msg.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
    console.log(`[${msg.params.type}] ${args}`);
  } else if (msg.method === "Runtime.exceptionThrown") {
    const ex = msg.params.exceptionDetails;
    console.log(`[EXCEPTION] ${ex.text} :: ${ex.exception?.description || ""}`);
  } else if (msg.method === "Log.entryAdded") {
    const e = msg.params.entry;
    console.log(`[${e.level}] ${e.text} (${e.url || ""}:${e.lineNumber || 0})`);
  } else if (msg.method === "Network.responseReceived") {
    if (msg.params.response.status >= 400) {
      console.log(`[NET ${msg.params.response.status}] ${msg.params.response.url}`);
    }
  } else if (msg.method === "Network.loadingFailed") {
    console.log(`[NET FAILED] ${msg.params.errorText} :: ${msg.params.requestId}`);
  }
});

ws.addEventListener("error", (e) => console.error("ws error", e.message));
ws.addEventListener("close", () => process.exit(0));
