/** DOM helpers and the menu screens. Every text comes from the language files. */
import { t } from '../i18n';
import { ICONS } from './icons';

export const ui = () => document.getElementById('ui')!;

export function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild as T;
}

export const ico = (name: keyof typeof ICONS, cls = 'ico') => `<span class="${cls}">${ICONS[name]}</span>`;

export function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** show one full-screen layer (removing the previous one of the same id) */
export function show(node: HTMLElement) {
  document.getElementById(node.id)?.remove();
  ui().append(node);
  return node;
}

export function hide(id: string) {
  document.getElementById(id)?.remove();
}

/** short-lived messages, timed on the game clock (so they pause and work frame by frame in captures) */
const timed: { node: HTMLElement; left: number }[] = [];
export function tickMessages(dt: number) {
  for (let i = later.length - 1; i >= 0; i--) {
    later[i].left -= dt;
    if (later[i].left <= 0) {
      later[i].node.classList.add(later[i].cls);
      later.splice(i, 1);
    }
  }
  for (let i = timed.length - 1; i >= 0; i--) {
    timed[i].left -= dt;
    if (timed[i].left <= 0 || !timed[i].node.isConnected) {
      timed[i].node.remove();
      timed.splice(i, 1);
    }
  }
}

/** add a class later (on the game clock) */
const later: { node: HTMLElement; cls: string; left: number }[] = [];
export function timedClass(node: HTMLElement, cls: string, sec: number) {
  later.push({ node, cls, left: sec });
}

export function timedRemove(node: HTMLElement, sec: number) {
  timed.push({ node, left: sec });
}

export function bubble(text: string, good = false, ms = 1800) {
  document.querySelectorAll('.bubble').forEach((b) => b.remove());
  const b = el(`<div class="bubble${good ? ' good' : ''}">${esc(text)}</div>`);
  ui().append(b);
  timed.push({ node: b, left: ms / 1000 });
  return b;
}

export function toast(text: string, ms = 2500) {
  const b = el(`<div class="toast">${esc(text)}</div>`);
  ui().append(b);
  timed.push({ node: b, left: ms / 1000 });
}

/**
 * A button press. Only a press that started on the button counts (or a keyboard press): a finger that was already
 * down in the game when a screen or the seed cards appeared must not press whatever button it is lifted over.
 */
export function onPress(b: HTMLElement, fn: (e: MouseEvent) => void) {
  let pressed = false;
  b.addEventListener('pointerdown', () => (pressed = true));
  b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (!pressed && ev.detail !== 0) return;
    pressed = false;
    fn(ev);
  });
}

export function onClick(root: HTMLElement, sel: string, fn: (e: HTMLElement) => void, sound?: () => void) {
  root.querySelectorAll<HTMLElement>(sel).forEach((b) =>
    onPress(b, () => {
      sound?.();
      fn(b);
    }),
  );
}

export function starsHtml(n: number, cls = 'ico') {
  return [0, 1, 2].map((i) => ico(i < n ? 'star' : 'starEmpty', cls)).join('');
}

export const label = (key: string, params?: Record<string, string | number>) => esc(t(key, params));
