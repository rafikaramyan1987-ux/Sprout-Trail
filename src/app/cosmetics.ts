/** Unlockable cosmetics: hats and sprite colours, bought with gems (saved in the progress save). */
import { persist, save } from './save';

export interface Item {
  id: string;
  kind: 'hat' | 'color';
  price: number;
  /** colour value (colours) */
  value?: string;
}

export const HATS: Item[] = [
  { id: 'none', kind: 'hat', price: 0 },
  { id: 'acorn', kind: 'hat', price: 150 },
  { id: 'flower', kind: 'hat', price: 300 },
  { id: 'bow', kind: 'hat', price: 450 },
  { id: 'mushroom', kind: 'hat', price: 650 },
  { id: 'straw', kind: 'hat', price: 900 },
  { id: 'crown', kind: 'hat', price: 1500 },
];

export const COLORS: Item[] = [
  { id: 'leaf', kind: 'color', price: 0, value: '#9fd66b' },
  { id: 'sun', kind: 'color', price: 120, value: '#f6d75a' },
  { id: 'sky', kind: 'color', price: 250, value: '#8fd0f2' },
  { id: 'blossom', kind: 'color', price: 400, value: '#f6a8c8' },
  { id: 'lavender', kind: 'color', price: 600, value: '#b9a2ee' },
  { id: 'autumn', kind: 'color', price: 800, value: '#f2a25a' },
  { id: 'moss', kind: 'color', price: 1100, value: '#5fae6a' },
];

export const cosmetics = {
  get hat() {
    return save.hat ?? 'none';
  },
  get color() {
    return COLORS.find((c) => c.id === (save.color ?? 'leaf'))?.value ?? COLORS[0].value!;
  },
};

export const owned = (it: Item) => it.price === 0 || save.owned.includes(it.id);
export const equipped = (it: Item) => (it.kind === 'hat' ? (save.hat ?? 'none') === it.id : (save.color ?? 'leaf') === it.id);

/** buy (if affordable) or equip; returns false if there are not enough gems */
export function buyOrEquip(it: Item): 'bought' | 'equipped' | 'poor' {
  let res: 'bought' | 'equipped' = 'equipped';
  if (!owned(it)) {
    if (save.gems < it.price) return 'poor';
    save.gems -= it.price;
    save.owned.push(it.id);
    res = 'bought';
  }
  if (it.kind === 'hat') save.hat = it.id;
  else save.color = it.id;
  persist();
  return res;
}
