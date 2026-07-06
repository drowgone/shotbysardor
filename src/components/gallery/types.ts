export type ContentCard = {
  slug: string;
  type: "PHOTO" | "VIDEO";
  title: string;
  thumbUrl: string;
  posterUrl: string | null;
  previewUrl: string | null;
  blurhash: string;
  width: number;
  height: number;
  origWidth: number | null;
  origHeight: number | null;
  // Bir kontent bir nechta janrga tegishli bo'lishi mumkin. Massiv bo'sh emas
  // (schema darajasida kontent kamida bitta janrga ulanadi).
  genres: { name: string; slug: string }[];
  location: { name: string; slug: string };
  capturedAt: string;
  viewsCount: number;
  featured: boolean;
  durationSec: number | null;
  __span?: number;
};

export type MetaData = {
  genres: { name: string; slug: string }[];
  locations: { name: string; slug: string }[];
  years: number[];
};
