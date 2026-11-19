/**
 * WDS Toast — <wds-toast-container> renders a fixed stack of toasts.
 * A container is auto-created on first use, so you rarely need to add
 * <wds-toast-container> to your page manually (but you can, e.g. to pick a
 * position: <wds-toast-container position="bottom-right">).
 *
 * Usage:
 *   import { toast } from "./components/toast/wds-toast.js";
 *   toast.success("Environment saved");
 *   toast.error("Could not save environment", { message: "Network timeout" });
 *   toast.info("Deploy queued", { action: { label: "View", onClick: () => ... } });
 *
 * Options: { message, duration (ms, 0 = sticky), action: { label, onClick } }
 */

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      position: fixed;
      z-index: var(--wds-z-toast);
      box-sizing: border-box;
      width: min(var(--wds-toast-max-width), calc(100vw - var(--wds-space-lg) - var(--wds-space-lg)));
      display: flex;
      padding: var(--wds-space-lg);
      pointer-events: none;
    }
    :host([position="top-right"])    { top: 0; right: 0; }
    :host([position="top-left"])     { top: 0; left: 0; }
    :host([position="bottom-right"]) { bottom: 0; right: 0; }
    :host([position="bottom-left"])  { bottom: 0; left: 0; }
    :host(:not([position])) { top: 0; right: 0; }

    .stack {
      display: flex;
      flex-direction: column;
      gap: var(--wds-space-xs);
      width: 100%;
    }
    :host([position="bottom-right"]) .stack,
    :host([position="bottom-left"]) .stack {
      flex-direction: column-reverse;
    }

    .toast {
      box-sizing: border-box;
      width: 100%;
      pointer-events: auto;
      display: flex;
      align-items: flex-start;
      gap: var(--wds-space-xs);
      padding: var(--wds-space-sm);
      background: var(--wds-surface);
      border: var(--wds-border-width) solid var(--wds-border);
      border-left: var(--wds-border-accent-width) solid var(--wds-neutral-400);
      border-radius: var(--wds-radius-md);
      box-shadow: var(--wds-shadow-lg);
      animation: wds-toast-in var(--wds-duration-base) var(--wds-ease);
    }
    .toast[data-leaving] {
      animation: wds-toast-out var(--wds-duration-base) var(--wds-ease) forwards;
    }
    .toast--success { border-left-color: var(--wds-success); }
    .toast--error   { border-left-color: var(--wds-danger); }
    .toast--warning { border-left-color: var(--wds-warning); }
    .toast--info    { border-left-color: var(--wds-info); }

    .icon { flex: none; margin-top: 1px; }
    .toast--success .icon { color: var(--wds-success); }
    .toast--error .icon   { color: var(--wds-danger); }
    .toast--warning .icon { color: var(--wds-warning); }
    .toast--info .icon    { color: var(--wds-info); }

    .content { flex: 1; min-width: 0; }
    .title {
      font-size: var(--wds-text-sm);
      font-weight: var(--wds-font-weight-medium);
      line-height: var(--wds-line-height-normal);
      color: var(--wds-text);
      overflow-wrap: anywhere;
    }
    .message {
      font-size: var(--wds-text-xs);
      line-height: var(--wds-line-height-normal);
      color: var(--wds-text-muted);
      margin-top: var(--wds-space-3xs);
      overflow-wrap: anywhere;
    }
    .action {
      margin-top: var(--wds-space-2xs);
      font-size: var(--wds-text-xs);
      font-weight: var(--wds-font-weight-medium);
      color: var(--wds-text-link);
      background: none; border: 0; padding: 0; cursor: pointer;
    }
    .close {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: var(--wds-icon-button-size);
      height: var(--wds-icon-button-size);
      margin: calc(-1 * var(--wds-space-2xs));
      color: var(--wds-text-subtle);
      background: none;
      border: 0;
      border-radius: var(--wds-radius-sm);
      cursor: pointer;
    }
    .close:hover { color: var(--wds-text); background: var(--wds-surface-sunken); }
    .close:focus-visible { outline: 2px solid var(--wds-focus-ring); outline-offset: 2px; }

    @keyframes wds-toast-in {
      from { opacity: 0; transform: translateY(-6px) scale(0.98); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes wds-toast-out {
      to { opacity: 0; transform: translateY(-6px) scale(0.98); }
    }
    @media (prefers-reduced-motion: reduce) {
      .toast,
      .toast[data-leaving] {
        animation: none;
      }
    }
  </style>
  <div class="stack"></div>
`;

const ICON_BY_TYPE = {
  success: "check-circle",
  error: "x-circle",
  warning: "alert-triangle",
  info: "info",
};

class WdsToastContainer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).appendChild(TEMPLATE.content.cloneNode(true));
  }

  show(type, title, { message = "", duration = 4000, action } = {}) {
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.setAttribute("role", type === "error" ? "alert" : "status");
    el.innerHTML = `
      <wds-icon class="icon" name="${ICON_BY_TYPE[type] || "info"}" size="18"></wds-icon>
      <div class="content">
        <div class="title"></div>
        ${message ? '<div class="message"></div>' : ""}
        ${action ? '<button type="button" class="action"></button>' : ""}
      </div>
      <button type="button" class="close" aria-label="Dismiss notification">
        <wds-icon name="close" size="14"></wds-icon>
      </button>
    `;
    el.querySelector(".title").textContent = title;
    if (message) el.querySelector(".message").textContent = message;
    if (action) {
      const actionBtn = el.querySelector(".action");
      actionBtn.textContent = action.label;
      actionBtn.addEventListener("click", () => {
        action.onClick?.();
        remove();
      });
    }

    let dismissTimer;
    let exitTimer;
    let startedAt = 0;
    let remaining = duration;
    let leaving = false;

    const finishRemove = () => {
      clearTimeout(exitTimer);
      el.remove();
    };

    const remove = () => {
      if (leaving) return;
      leaving = true;
      clearTimeout(dismissTimer);
      el.setAttribute("data-leaving", "");
      el.addEventListener("animationend", finishRemove, { once: true });
      exitTimer = setTimeout(finishRemove, 250);
    };

    el.querySelector(".close").addEventListener("click", remove);
    this.shadowRoot.querySelector(".stack").appendChild(el);

    if (duration > 0) {
      const schedule = () => {
        startedAt = Date.now();
        dismissTimer = setTimeout(remove, remaining);
      };
      el.addEventListener("mouseenter", () => {
        clearTimeout(dismissTimer);
        remaining = Math.max(0, remaining - (Date.now() - startedAt));
      });
      el.addEventListener("mouseleave", schedule);
      schedule();
    }
    return { dismiss: remove };
  }
}

customElements.define("wds-toast-container", WdsToastContainer);

function getContainer(position) {
  let container = document.querySelector("wds-toast-container" + (position ? `[position="${position}"]` : ":not([position])"));
  if (!container) {
    container = document.createElement("wds-toast-container");
    if (position) container.setAttribute("position", position);
    document.body.appendChild(container);
  }
  return container;
}

function makeToastFn(type) {
  return (title, options) => getContainer(options?.position).show(type, title, options);
}

export const toast = {
  success: makeToastFn("success"),
  error: makeToastFn("error"),
  warning: makeToastFn("warning"),
  info: makeToastFn("info"),
};
