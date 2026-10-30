// 임시 화면: 서버 자기소개 이름만 보여 준다 (Task 7~9에서 매장 화면으로 바뀐다)
const app = document.getElementById('app')!;
fetch('/api/myself')
  .then((r) => r.json())
  .then((d: { name: string }) => { app.textContent = d.name; })
  .catch(() => { app.textContent = '서버에 연결하지 못했어요'; });
