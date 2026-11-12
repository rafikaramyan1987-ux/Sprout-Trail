/**
 * One-finger controls and the keyboard.
 * - Touch / mouse anywhere on the game: tap or swipe up = jump (keep the finger down for a higher jump), swipe down
 *   = duck / slide (keep it down to stay low). A touch jumps at once (no waiting to see whether it becomes a swipe:
 *   that delay made every touch jump 70 ms later than a key press); a swipe down that follows turns it into a duck
 *   (still on the ground: no jump at all; already in the air: a dive into the duck).
 * - Keyboard (KeyboardEvent.code, so QWERTY and AZERTY both work): Space / ArrowUp / W = jump (hold for higher),
 *   ArrowDown / S = duck. Escape is never used for a game action.
 */
import type { Input } from '../game/sim';

const SWIPE_PX = 22;
const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
const DUCK_KEYS = new Set(['ArrowDown', 'KeyS']);

export type GestureKind = 'tap' | 'swipeDown';

class Controls {
  enabled = false;
  private jumpEdge = false;
  private duckEdge = false;
  private jumpKey = false;
  private duckKey = false;
  private touchJump = false;
  private touchDuck = false;
  /** the touch that just started (until it is lifted or has become a swipe down) */
  private pending: { id: number; x: number; y: number } | null = null;
  private active: number | null = null;
  /** a gesture was recognised (the tutorial hand and the video's finger dot listen) */
  onGesture: (g: GestureKind, x: number, y: number) => void = () => {};
  /** any key / touch (to unlock audio) */
  onAny: () => void = () => {};
  /** the player used the keyboard at least once (the tutorial signs switch to key hints) */
  keyboard = false;

  attach(surface: HTMLElement) {
    surface.addEventListener('pointerdown', (e) => {
      this.onAny();
      if (!this.enabled || this.active !== null) return;
      if ((e.target as HTMLElement).closest('button, .ui-block')) return;
      e.preventDefault();
      this.active = e.pointerId;
      this.pending = { id: e.pointerId, x: e.clientX, y: e.clientY };
      this.fireJump(e.clientX, e.clientY);
    });
    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerId !== this.active || !this.pending) return;
        const dy = e.clientY - this.pending.y;
        if (dy > SWIPE_PX) this.fireDuck(e.clientX, e.clientY);
      },
      { passive: true },
    );
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.active) return;
      this.pending = null;
      this.active = null;
      this.touchJump = false;
      this.touchDuck = false;
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', (e) => {
      this.onAny();
      if (!this.enabled) return;
      if (JUMP_KEYS.has(e.code) || DUCK_KEYS.has(e.code)) {
        e.preventDefault();
        this.keyboard = true;
        if (e.repeat) return;
        if (JUMP_KEYS.has(e.code)) {
          this.jumpKey = true;
          this.jumpEdge = true;
        } else {
          this.duckKey = true;
          this.duckEdge = true;
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      if (JUMP_KEYS.has(e.code)) this.jumpKey = false;
      if (DUCK_KEYS.has(e.code)) this.duckKey = false;
    });
    window.addEventListener('blur', () => this.release());
  }

  private fireJump(x: number, y: number) {
    this.jumpEdge = true;
    this.touchJump = true;
    this.onGesture('tap', x, y);
  }
  private fireDuck(x: number, y: number) {
    this.pending = null;
    // a jump not taken yet is no jump at all; one already taken dives into the duck (sim: duck in the air)
    this.jumpEdge = false;
    this.touchJump = false;
    this.duckEdge = true;
    this.touchDuck = true;
    this.onGesture('swipeDown', x, y);
  }

  release() {
    this.jumpKey = this.duckKey = this.touchJump = this.touchDuck = false;
    this.jumpEdge = this.duckEdge = false;
    this.pending = null;
    this.active = null;
  }

  /** the input for one simulation tick (press edges are consumed) */
  sample(): Input {
    const inp: Input = {
      jumpPressed: this.jumpEdge,
      jumpHeld: this.jumpKey || this.touchJump || this.jumpEdge,
      duckPressed: this.duckEdge,
      duckHeld: this.duckKey || this.touchDuck,
    };
    this.jumpEdge = false;
    this.duckEdge = false;
    return inp;
  }
}

export const controls = new Controls();
