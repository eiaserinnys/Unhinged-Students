---
name: organize-claude-md
description: CLAUDE.md 정리 요청 시 적용. "CLAUDE.md 정리", "메모리 파일 최적화", "프로젝트 규칙 정리" 같은 요청 시 사용.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# CLAUDE.md 정리하기

Claude Code의 메모리 파일(CLAUDE.md)을 베스트 프랙티스에 맞게 정리합니다.

---

## 1. CLAUDE.md 개요

CLAUDE.md는 Claude Code가 세션 시작 시 자동으로 로드하는 **지속적 컨텍스트/규칙(메모리)** 파일입니다.

### 메모리 파일 종류와 위치

| 스코프 | 위치 | 용도 |
|--------|------|------|
| Enterprise | `/Library/Application Support/ClaudeCode/CLAUDE.md` (macOS) | 조직 공통 정책 |
| User | `~/.claude/CLAUDE.md` | 개인 공통 설정 |
| Project | `./CLAUDE.md` 또는 `./.claude/CLAUDE.md` | 프로젝트 공통 (팀 공유) |
| Project rules | `./.claude/rules/*.md` | 프로젝트 규칙 분리 관리 |
| Project local | `./CLAUDE.local.md` | 개인+프로젝트 전용 (자동 gitignore) |

### 로딩 규칙

1. **상위 탐색**: cwd에서 루트까지 올라가며 CLAUDE.md 발견 시 모두 로드
2. **하위 온디맨드**: 서브트리의 CLAUDE.md는 해당 폴더 파일을 다룰 때 로드
3. **@참조 시 동반 로드**: `@path/to/file` 참조 시 그 경로의 CLAUDE.md도 함께 로드
4. **import**: `@path/to/import` 문법으로 다른 파일 포함 가능 (최대 5 hops)
5. **rules/**: `.claude/rules/*.md`는 프로젝트 메모리와 동급으로 자동 로드

---

## 2. 베스트 프랙티스

### 2.1 계층형 + 모듈형으로 쪼개기

```
프로젝트/
├── CLAUDE.md                    # 프로젝트 공통 (빌드, 테스트, 전역 규칙)
├── CLAUDE.local.md              # 개인 설정 (gitignore)
├── .claude/
│   ├── CLAUDE.md                # CLAUDE.md와 동급 (선택)
│   └── rules/
│       ├── coding-style.md      # 코딩 스타일 규칙
│       ├── testing.md           # 테스트 규칙
│       └── api.md               # API 관련 규칙
└── packages/
    └── api/
        └── CLAUDE.md            # 서브모듈 전용 규칙 (온디맨드 로드)
```

### 2.2 간결하고 구체적으로

```markdown
# 좋은 예
- 들여쓰기: 2 spaces
- 함수명: camelCase
- 상수: UPPER_SNAKE_CASE

# 나쁜 예
- 코드를 잘 포맷해주세요
- 깔끔하게 작성해주세요
```

### 2.3 중복 대신 import / rules로 DRY

- 공통 문서는 한 곳에 두고 `@path/to/file`로 import
- 주제별로 `.claude/rules/`에 분리
- import 깊이 5 hops 제한 주의

### 2.4 팀 공유 vs 개인 분리

| 구분 | 파일 | Git |
|------|------|-----|
| 팀 공유 | `CLAUDE.md`, `.claude/rules/` | 커밋 |
| 개인 전역 | `~/.claude/CLAUDE.md` | - |
| 개인+프로젝트 | `CLAUDE.local.md` | gitignore |

### 2.5 paths로 규칙 범위 제한

```yaml
---
paths:
  - "src/**/*.ts"
  - "tests/**/*.test.ts"
---

# Testing Rules
- 새 기능은 테스트 필수
```

---

## 3. 작업 절차

### 3.1 현황 파악

1. `/memory` 명령으로 현재 로드된 메모리 확인
2. 프로젝트 내 CLAUDE.md 파일들 탐색:
   ```
   - ./CLAUDE.md
   - ./.claude/CLAUDE.md
   - ./.claude/rules/*.md
   - ./CLAUDE.local.md
   - 서브폴더/CLAUDE.md
   ```

### 3.2 문제점 분석

- [ ] 중복된 규칙이 여러 파일에 있는가?
- [ ] 너무 긴 CLAUDE.md가 있는가?
- [ ] 모호하거나 추상적인 규칙이 있는가?
- [ ] 개인 설정이 팀 공유 파일에 섞여 있는가?
- [ ] 특정 폴더에만 해당하는 규칙이 루트에 있는가?

### 3.3 정리 수행

1. **분리**: 긴 CLAUDE.md를 주제별 `.claude/rules/`로 분리
2. **통합**: 중복 규칙은 한 곳으로 모으고 import
3. **구체화**: 모호한 규칙을 구체적으로 재작성
4. **이동**:
   - 개인 설정 → `CLAUDE.local.md`
   - 서브모듈 전용 → 해당 폴더의 `CLAUDE.md`
5. **paths 적용**: 특정 경로에만 해당하는 규칙에 frontmatter 추가

### 3.4 검증

- `/memory`로 로드 상태 확인
- 규칙 충돌/중복 없는지 확인

---

## 4. 템플릿

### 루트 CLAUDE.md

```markdown
# Project Overview
- 목적: ...
- 주요 스택: ...
- 디렉터리 맵: src/..., packages/...

# Commands
- build: npm run build
- test: npm test
- lint: npm run lint

# Code Style (Global)
- 들여쓰기: 2 spaces
- 네이밍: camelCase (함수), PascalCase (클래스)

# Workflow
- 변경 후: lint + test 실행
- PR 규칙: ...
```

### .claude/rules/testing.md

```markdown
---
paths:
  - "src/**/*.ts"
  - "tests/**/*.test.ts"
---

# Testing Rules
- 새 기능은 테스트 필수
- 테스트 네이밍: describe('모듈명', () => { it('동작', ...) })
- mocking: 외부 의존성만
```

### CLAUDE.local.md

```markdown
# Local Setup
- 로컬 DB: docker compose 사용
- 서버 포트: 5173
- 개인 스크립트: ./scripts/dev.sh
```

---

## 5. 주의사항

- **민감정보 금지**: API 키, 비밀번호 등은 메모리에 넣지 말 것
- **import 깊이**: 최대 5 hops 제한
- **외부 import**: 저장소 밖 파일 import 시 승인 프롬프트 발생 가능
- **우선순위**: 유저 룰 → 프로젝트 룰 순서로 로드, 프로젝트 룰이 우선
- **# 단축키**: 예전 버전의 `#` 메모리 추가 단축키는 제거됨
