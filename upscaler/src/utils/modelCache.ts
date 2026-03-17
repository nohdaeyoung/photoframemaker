import { get as idbGet, set as idbSet } from 'idb-keyval';

const MODEL_KEY = 'realesrgan-x4v3-v1';

export async function getCachedModel(): Promise<ArrayBuffer | undefined> {
  try {
    return await idbGet<ArrayBuffer>(MODEL_KEY);
  } catch {
    return undefined;
  }
}

export async function setCachedModel(buffer: ArrayBuffer): Promise<void> {
  try {
    await idbSet(MODEL_KEY, buffer);
  } catch {
    // 캐싱 실패는 무시 (다음 방문 시 재다운로드)
  }
}
