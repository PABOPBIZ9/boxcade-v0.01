export const SOL = 180;

export type Series = [name: string, side: string, shade: string, accent: string];

export const SER: Series[] = [
  ["Lucky Crate", "#ff3d5a", "#c41e45", "#ffc93c"],
  ["Midway Mystery", "#14c8b8", "#0a8f85", "#ffc93c"],
  ["High Roller", "#6c4bff", "#4630c4", "#ff7ab6"],
];

export const NM = ["Pip", "Dot", "Mango", "Zazz", "Biscuit", "Noodle", "Fizz", "Gizmo"];

export type Box = {
  id: number;
  n: string;
  p: number;
  s: Series;
  kind: string;
  by: string;
};

export const boxes: Box[] = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  n: String(101 + (i * 7) % 900).padStart(4, "0"),
  p: +(0.6 * Math.pow(1.09, i)).toFixed(2),
  s: SER[(i * 5) % 3],
  kind: i % 4 === 0 ? "Physical + digital" : "Digital",
  by: "@" + NM[i % 8] + String((i * 13) % 90),
}));

export type Offer = [price: number, from: string, expires: string];
export const offers: Offer[] = [
  [0.55, "@pusat", "2d 22h"],
  [0.4, "@kenshiko", "15h"],
  [0.33, "@harba", "2d 6h"],
  [0.3, "@dany", "6d"],
];

export const acts = Array.from({ length: 14 }, (_, i) => {
  const box = boxes[(i * 7) % 40];
  return [["Sale", "Listed", "Offer", "Transfer"][i % 4], box, box.p, NM[i % 8], i * 37 + 3] as const;
});

export const CH: Record<string, string[]> = {
  Solana: ["USDC", "USDT", "SOL"],
  Ethereum: ["USDC", "USDT", "ETH"],
  "Robinhood Chain": ["ETH", "USDC"],
  Bitcoin: ["BTC"],
  Zcash: ["ZEC"],
};

export const f = (n: number, d = 2) => (+n).toFixed(d);
export const usd = (n: number) => "$" + Math.round(n * SOL).toLocaleString();
export const sol = (n: number) => f(n) + " SOL";
