# 회복 루틴 트래커

워크홀릭 생활 패턴, 건강 루틴, 가족 시간, 부부 약속을 매일 기록하는 모바일 친화 웹앱입니다.

## 주요 기능

- 근무 시작/종료와 기상 시간을 기록
- 근무 종료 시간부터 기상 시간까지 수면 시간 자동 계산
- 새벽 근무, 과로 위험, 회복 점수 자동 계산
- 건강 루틴, 저녁 시간 루틴, 와이프와의 약속 체크
- 매일 기록 알림 설정
- 브라우저 로컬 저장
- Vercel API + Supabase 공유 저장 지원
- 모바일 홈 화면 추가를 위한 PWA 기본 설정

## 사용 방법

`index.html`을 브라우저에서 열면 바로 사용할 수 있습니다.

웹에 배포하면 아이폰과 갤럭시에서 같은 주소로 열 수 있고, 홈 화면에 추가해 앱처럼 사용할 수 있습니다.

## Supabase 저장 설정

1. Supabase에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase-schema.sql` 내용을 실행합니다.
3. Vercel 프로젝트 Environment Variables에 아래 값을 추가합니다.

- `SUPABASE_URL`: Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `COUPLE_ID`: 둘만 쓸 고유 코드. 예: `our-family-2026`

Vercel에 배포되면 앱은 `/api/logs`를 통해 Supabase에 저장합니다. `SUPABASE_SERVICE_ROLE_KEY`는 브라우저에 노출되면 안 되므로 반드시 Vercel 환경변수에만 넣으세요.

로컬 파일로 열 때는 기존처럼 브라우저 안에 저장됩니다.
