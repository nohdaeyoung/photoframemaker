import exifr from 'exifr';
import { type ExifData } from '../types';

export async function parseExifFromFile(file: File): Promise<Partial<ExifData>> {
  try {
    const data = await exifr.parse(file, {
      pick: ['Make', 'Model', 'LensModel', 'FNumber', 'ExposureTime', 'ISO', 'DateTimeOriginal', 'FocalLength'],
    });
    if (!data) return {};

    const result: Partial<ExifData> = {};

    if (data.Make || data.Model) {
      const make = data.Make?.trim() || '';
      const model = data.Model?.trim() || '';
      result.camera = model.startsWith(make) ? model : (make ? `${make} ${model}` : model);
    }

    if (data.LensModel) result.lens = data.LensModel.trim();

    if (data.FNumber != null) {
      const f = data.FNumber;
      result.aperture = `f/${f % 1 === 0 ? f.toFixed(0) : f.toFixed(1)}`;
    }

    if (data.ExposureTime != null) {
      const t = data.ExposureTime;
      result.shutter = t >= 1 ? `${t}s` : `1/${Math.round(1 / t)}s`;
    }

    if (data.ISO != null) result.iso = String(data.ISO);

    if (data.FocalLength != null) result.focal = `${Math.round(data.FocalLength)}mm`;

    if (data.DateTimeOriginal) {
      const d = data.DateTimeOriginal;
      const str = typeof d === 'string'
        ? d.replace(/^(\d{4}):(\d{2}):(\d{2}).*/, '$1.$2.$3')
        : d instanceof Date
          ? `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
          : '';
      if (str) result.date = str;
    }

    return result;
  } catch {
    return {};
  }
}
