export interface ExifData {
  camera: string;
  lens: string;
  aperture: string;
  shutter: string;
  iso: string;
  focal: string;
  date: string;
  film?: string;
}

export interface AppState {
  styleId: string;
  theme: 'light' | 'dark';
  imageSrc: string;
  imageRatio: number;
  exif: ExifData;
  orientation: 'portrait' | 'landscape';
}

export interface StyleDef {
  id: string;
  name: string;
  desc: string;
}

export const STYLES: StyleDef[] = [
  { id: 'fujifilm',      name: 'Fuji Recipe',     desc: 'Film simulation style' },
  { id: 'glassmorphism', name: 'Glassmorphism',   desc: 'Modern glass UI overlay' },
  { id: 'leica',         name: 'Leica Lux',       desc: 'Premium minimalist' },
  { id: 'polaroid',      name: 'Polaroid',        desc: 'Vintage instant film' },
  { id: 'negative',      name: 'Film Strip',      desc: '35mm analog strip' },
  { id: 'shoton',        name: 'Shot On',         desc: 'Camera dashboard' },
  { id: 'magazine',      name: 'Editorial',       desc: 'High-end publication' },
  { id: 'dashboard',     name: 'HUD',             desc: 'Technical sci-fi reticle' },
  { id: 'minimal',       name: 'Minimal Line',    desc: 'Invisible design' },
  { id: 'grid',          name: 'Card Grid',       desc: 'Dense info cards' },
];

export const DEFAULT_EXIF: ExifData = {
  camera: 'FUJIFILM X-T5',
  lens: 'XF 35mm F1.4 R',
  aperture: 'f/1.4',
  shutter: '1/500s',
  iso: '400',
  focal: '35mm',
  date: '2024.12.25',
  film: 'Classic Negative',
};
