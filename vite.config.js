import { defineConfig } from 'vite';

export default defineConfig({
    root: '.', // index.html 위치
    publicDir: 'asset', // 정적 파일 폴더 → dist/asset으로 복사됨
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    server: {
        port: 8000,
        proxy: {
            // Socket.IO 프록시 (개발 시 Express 서버로)
            '/socket.io': {
                target: 'http://localhost:3000',
                ws: true,
            },
            // game/socket.io 패스도 프록시 (nginx 프로덕션 환경과 동일하게)
            '/game/socket.io': {
                target: 'http://localhost:3000',
                ws: true,
                rewrite: (path) => path.replace(/^\/game/, ''),
            },
        },
    },
});
