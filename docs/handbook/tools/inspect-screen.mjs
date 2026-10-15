/**
 * Handbook — screen inspector.
 *
 * Prints what is actually on a screen: every visible text string, and every
 * button with its accessible name and test id. Used to write selectors from
 * reality instead of from guesswork when a capture step cannot find something.
 *
 * Run: node docs/handbook/tools/inspect-screen.mjs
 *      node docs/handbook/tools/inspect-screen.mjs /home
 */
import { openApp, login, goToRoute } from "./app-session.mjs";
import { env } from "./env.mjs";

const EVENT_ID = env("HANDBOOK_EVENT_ID");

const ROUTES = process.argv[2]
  ? [process.argv[2]]
  : [
      "/home",
      `/${EVENT_ID}/overview`,
      `/${EVENT_ID}/registrations`,
      `/${EVENT_ID}/check-in`,
      `/${EVENT_ID}/walk-in`,
      `/${EVENT_ID}/badges`,
      `/${EVENT_ID}/nfc-bind`,
      `/${EVENT_ID}/nfc-read`,
      `/${EVENT_ID}/nfc-exchange`,
      `/${EVENT_ID}/token`,
      "/settings",
    ];

const INVENTORY = () => {
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const texts = new Set();
  const buttons = [];
  for (const el of document.querySelectorAll("#root *")) {
    if (!visible(el)) continue;
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (own) texts.add(own);

    if (el.tagName === "BUTTON") {
      const r = el.getBoundingClientRect();
      buttons.push({
        aria: el.getAttribute("aria-label") ?? "",
        testid: el.getAttribute("data-testid") ?? "",
        text: (el.innerText ?? "").replace(/\n+/g, " / ").slice(0, 60),
        disabled: el.disabled ? "DISABLED" : "",
        box: [
          Math.round(r.x),
          Math.round(r.y),
          Math.round(r.width),
          Math.round(r.height),
        ].join(","),
      });
    }
  }
  const inputs = Array.from(document.querySelectorAll("input")).map((el) => ({
    type: el.type,
    placeholder: el.placeholder ?? "",
    testid: el.getAttribute("data-testid") ?? "",
  }));

  const testids = [];
  for (const el of document.querySelectorAll("[data-testid]")) {
    if (!visible(el)) continue;
    testids.push(
      `${el.tagName.toLowerCase()}[${el.getAttribute("data-testid")}]`,
    );
  }

  // The bottom tab bar is not made of buttons; find whatever it actually is.
  const h = window.innerHeight;
  const tabbar = [];
  for (const el of document.querySelectorAll("#root *")) {
    const r = el.getBoundingClientRect();
    if (!visible(el) || r.top < h - 110) continue;
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (own) {
      tabbar.push(
        `${el.tagName.toLowerCase()} role="${el.getAttribute("role") ?? ""}" aria="${el.getAttribute("aria-label") ?? ""}" text="${own}"`,
      );
    }
  }
  return { texts: [...texts], buttons, inputs, testids, tabbar };
};

const app = await openApp();
const { page } = app;

await goToRoute(page, "/");
await login(page);

for (const route of ROUTES) {
  await goToRoute(page, route);
  const inv = await page.evaluate(INVENTORY);
  console.log(`\n========== ${route} ==========`);
  console.log(`TEXTS: ${inv.texts.join(" ‧ ")}`);
  if (inv.inputs.length) console.log(`INPUTS: ${JSON.stringify(inv.inputs)}`);
  if (inv.testids.length) console.log(`TESTIDS: ${inv.testids.join(" ")}`);
  if (inv.tabbar.length) console.log(`TABBAR: ${inv.tabbar.join(" | ")}`);
  for (const b of inv.buttons) {
    console.log(
      `  BUTTON [${b.box}]${b.disabled ? " " + b.disabled : ""} aria="${b.aria}" testid="${b.testid}" text="${b.text}"`,
    );
  }
}

await app.close();
