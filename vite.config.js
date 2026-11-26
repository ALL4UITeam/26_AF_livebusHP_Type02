import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const page = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));

export default defineConfig({
  // GitHub Pages 배포 경로. 저장소 이름이나 배포 주소가 바뀌면 함께 고친다.
  base: '/26_AF_livebusHP_Type02/',
  build: {
    rollupOptions: {
      // 배포에 포함되는 페이지는 이 둘이다. 보존본(concept-a, concept-b-v1~v3, concept-b-livefield)은 개발 서버에서만 열린다.
      input: {
        index: page('index.html'),          // 도입 문의
        'concept-b': page('concept-b.html'), // 서비스 경험(3D)
      },
    },
  },
});
