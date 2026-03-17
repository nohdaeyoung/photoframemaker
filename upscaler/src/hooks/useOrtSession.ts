import { useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';
import type { ExecutionProvider } from '../types';

// 단일 스레드 (SharedArrayBuffer 불필요)
ort.env.wasm.numThreads = 1;

const MODEL_URL = `${import.meta.env.BASE_URL}models/realesr-general-x4v3.onnx`;

interface UseOrtSessionResult {
  session: ort.InferenceSession | null;
  ep: ExecutionProvider;
  isLoading: boolean;
  loadProgress: number;
  error: string | null;
}

export function useOrtSession(): UseOrtSessionResult {
  const [session, setSession] = useState<ort.InferenceSession | null>(null);
  const [ep, setEp] = useState<ExecutionProvider>('wasm');
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        // 1. fetch + streaming progress
        const response = await fetch(MODEL_URL);
        if (!response.ok) throw new Error(`모델 로드 실패: ${response.status}`);

        const contentLength = Number(response.headers.get('content-length') ?? 0);
        const reader = response.body!.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          const progress = contentLength > 0
            ? Math.round((received / contentLength) * 80)
            : Math.min(80, Math.round(received / 50000));
          setLoadProgress(progress);
        }

        // 2. ArrayBuffer 조합
        const combined = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        setLoadProgress(85);

        // 3. ONNX 세션 생성
        const sess = await ort.InferenceSession.create(combined.buffer, {
          executionProviders: ['wasm'],
        });

        setEp('wasm');
        setSession(sess);
        setLoadProgress(100);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  return { session, ep, isLoading, loadProgress, error };
}
