# Unhinged Students - Claude 개발 가이드

이 문서는 Unhinged Students 프로젝트의 개요와 개발 환경 설정 방법을 정의합니다.

## 📋 프로젝트 개요

**Unhinged Students**는 5 vs 5 팀전 기반의 HTML5 캔버스 게임입니다.

### 기획서

모든 개발 작업은 반드시 기획서를 참고해야 합니다. 기획서는 `docs/` 디렉토리에 위치합니다:

- **`docs/overview.md`** - 게임 전체 개요 및 스크린 플로우
  - 게임 기본 메커니즘 (5 vs 5 팀전)
  - 전체 스크린 플로우 (접속 → 로비 → 게임 → 결과 → 보상)
  - 각 화면의 역할과 구성 요소
  - 재화 시스템 (루비, 다이아)

- **`docs/characters.md`** - 캐릭터 상세 스펙
  - 외계인 (기본 캐릭터)
  - 눈 돌아가는 사람
  - 카레 곰돌이 (탱커)
  - 헐크 언니
  - 찍찍찍찍찍 (트릭형)
  - 선생님 (위장 능력)

- **`docs/production.md`** - 린 개발 순서
  - 단계별 구현 계획
  - MVP부터 확장하는 개발 전략
  - 로컬 → 멀티 → 스크린 확장 순서

## 🎮 게임 실행 방법

프로젝트는 순수 HTML5 + JavaScript로 개발되어 별도 빌드 없이 실행 가능합니다.

### 로컬 개발 서버 실행

**Python 사용:**
```bash
# 프로젝트 루트 디렉토리에서
python -m http.server 8000

# 브라우저에서 접속
# http://localhost:8000
```

**또는 다른 웹 서버 사용:**
- Live Server (VS Code 확장)
- `npx http-server`
- 기타 정적 파일 서버

## 📁 프로젝트 구조

```
Unhinged-Students/
├── index.html              # 메인 게임 HTML
├── CLAUDE.md              # 개발 가이드라인 (본 문서)
├── TODO.md                # 작업 목록 및 진행 상황
├── README.md              # 프로젝트 설명
│
├── .claude/               # Claude Code 설정
│   ├── rules/             # 프로젝트 개발 규칙 (모듈별 분리)
│   │   ├── testing.md         # 테스트 규칙
│   │   ├── workflow.md        # 워크플로우 및 작업 관리
│   │   └── documentation.md   # 문서 관리 규칙
│   ├── settings.local.json    # 로컬 설정
│   └── skills/            # 커스텀 스킬
│       └── organize-claude-md.md # CLAUDE.md 정리 스킬
│
├── docs/                  # 기획 문서
│   ├── overview.md        # 게임 전체 개요
│   ├── characters.md      # 캐릭터 스펙
│   └── production.md      # 개발 단계 계획
│
├── src/                   # 소스 코드
│   ├── game.js            # 메인 게임 루프 및 상태 관리
│   ├── input.js           # 입력 시스템 (키보드/마우스/터치)
│   ├── character.js       # 캐릭터 클래스 및 로직
│   └── shard.js           # 샤드(수집 아이템) 시스템
│
├── asset/                 # 게임 에셋
│   └── image/
│       └── alien.png      # 외계인 캐릭터 스프라이트
│
└── test/                  # 테스트 페이지
    ├── input.test.html    # 입력 시스템 테스트
    ├── character.test.html # 캐릭터 시스템 테스트
    └── shard.test.html    # 샤드 시스템 테스트
```

## 🔧 기술 스택

- **프론트엔드**: 순수 HTML5, CSS3, JavaScript (ES6+)
- **렌더링**: Canvas API
- **버전 관리**: Git/GitHub
- **개발 서버**: Python HTTP Server (또는 기타)

## 📊 작업 현황

작업 진행 상태 및 완료 항목은 **`TODO.md`**를 참고하세요.

## 📖 개발 규칙

개발 규칙은 `.claude/rules/` 디렉토리에 주제별로 분리되어 있습니다:

- **`testing.md`** - 테스트 주도 개발, 테스트 실행 규칙
- **`workflow.md`** - 워크플로우, TODO.md 관리, 점진적 개발
- **`documentation.md`** - 문서 관리 규칙, 기획서 참조

이 규칙들은 Claude Code가 자동으로 로드합니다.
