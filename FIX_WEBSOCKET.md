# WebSocket 연결 오류 해결 방법

## 문제
- `[Vite] server connection lost. Polling for restart...`
- `WebSocket connection to 'ws://localhost:3000/' failed`

## 원인
Vite 개발 서버가 제대로 실행되지 않았거나, WebSocket 연결이 끊어진 상태입니다.

## 해결 방법

### 1단계: 개발 서버 완전히 종료

터미널에서:
```bash
# Ctrl+C로 서버 종료 (여러 번 눌러보세요)
# 또는
pkill -f vite
```

### 2단계: 포트 확인 및 해제

```bash
# 포트 3000을 사용하는 프로세스 확인
lsof -i :3000

# 프로세스 종료 (PID가 표시되면)
kill -9 [PID]
```

### 3단계: 개발 서버 재시작

```bash
npm run dev
```

정상적으로 실행되면 다음과 같은 메시지가 표시됩니다:
```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.x.x:3000/
```

### 4단계: 브라우저 새로고침

1. 브라우저에서 **강력 새로고침**: `Ctrl+Shift+R` (Windows) 또는 `Cmd+Shift+R` (Mac)
2. 또는 브라우저를 완전히 닫았다가 다시 열기

## 여전히 문제가 있는 경우

### 대안 1: 다른 포트 사용

`vite.config.ts`에서 포트 변경:
```typescript
server: {
  port: 3001,  // 3000 대신 다른 포트
  host: '0.0.0.0',
},
```

그리고 `http://localhost:3001`로 접속

### 대안 2: 캐시 삭제

```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install

# 개발 서버 재시작
npm run dev
```

### 대안 3: Vite 캐시 삭제

```bash
rm -rf node_modules/.vite
npm run dev
```

## 확인 사항

✅ 개발 서버가 실행 중인지 확인
✅ 터미널에 "VITE ready" 메시지가 있는지 확인
✅ 브라우저에서 올바른 URL로 접속했는지 확인 (`http://localhost:3000`)
✅ 방화벽이 WebSocket을 차단하지 않는지 확인

