import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

// dev에서 부모 디렉토리의 nav.css, site.js 제공
function parentStaticPlugin() {
  const parentDir = path.resolve(__dirname, '..');
  const files: Record<string, string> = {
    'nav.css': 'text/css',
    'site.js': 'application/javascript',
  };
  return {
    name: 'serve-parent-static',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        // /nav.css 또는 /upscale/nav.css 둘 다 매칭
        const basename = req.url?.split('/').pop()?.split('?')[0] || '';
        const mime = files[basename];
        if (mime) {
          const filePath = path.join(parentDir, basename);
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', mime);
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [parentStaticPlugin(), tailwindcss(), react()],
  base: '/upscale/',
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  build: {
    outDir: '../upscale',
    emptyOutDir: true,
  },
});
