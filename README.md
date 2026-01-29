# DILikGram - 비주얼 워크플로우 빌더

React와 TypeScript, [react-cosmos-diagram](https://github.com/yourusername/react-cosmos-diagram)을 기반으로 한 비주얼 워크플로우 빌더입니다. 드래그 앤 드롭으로 워크플로우를 구성하고, JavaScript로 각 노드의 동작을 정의할 수 있습니다.

## 주요 기능

### 🎨 비주얼 워크플로우 디자이너
- 직관적인 드래그 앤 드롭 인터페이스
- 5가지 노드 타입 (Start, End, Task, Decision, Service)
- 실시간 노드 연결 및 배치

### 🎯 고급 드래그 앤 드롭 시스템
- **NodeTemplatePanel**: 노드 템플릿을 관리하는 사이드 패널
- **스마트 배치**: Panel 밖에서만 노드가 Diagram에 추가됨
- **Sortable**: Panel 내에서 템플릿 순서 변경 가능
- **접근성**: Panel이 닫혀있을 때 자식 요소 선택 방지

### ⚙️ 커스텀 Executor
- JavaScript로 각 노드의 로직 작성
- 비동기 함수 자동 감지
- fetch API 지원

### 🔄 실시간 실행 시뮬레이션
- 워크플로우 실행 과정 시각화
- 노드별 실행 상태 표시
- 애니메이션 엣지로 데이터 흐름 표현

### 📊 실행 통계
- 완료된 노드 수
- 에러 발생 노드
- 총 실행 시간

## 사용 가이드

### 1. 노드 추가하기

1. 좌측 상단의 버튼을 클릭하여 NodeTemplatePanel 열기
2. 원하는 노드 타입을 드래그
3. Diagram 영역에 드롭

**주의:** Panel 내부에 드롭하면 노드 순서만 변경되고, Diagram에는 추가되지 않습니다.

### 2. 노드 연결하기

1. 시작 노드의 포트를 클릭
2. 대상 노드의 포트로 드래그

**제약사항:** 한 노드는 하나의 부모 노드만 가질 수 있습니다.

### 3. Executor 설정하기

1. 노드를 더블 클릭하여 Properties Panel 열기
2. 각 노드 별 데이터 수정 및 저장

### 4. 워크플로우 실행하기

1. Start 노드 클릭
2. 실행 과정 관찰
3. End 노드 더블 클릭하여 실행 결과 확인

## 노드 타입

### Start Node (시작 노드)
- 워크플로우의 시작점
- 클릭 시 워크플로우 실행

### End Node (종료 노드)
- 워크플로우의 종료점
- 더블 클릭 시 실행 결과 요약 확인

### Task Node (작업 노드)
- 일반적인 작업 수행
- 입력 데이터를 받아 변환하여 출력
- Executor Panel에서 JavaScript 코드를 입력해 Input Data를 가공해 Output Data 반환
- Properties panel에서 Meta Data를 추가해 노드에 시각화 가능

### Decision Node (분기 노드)
- 조건에 따라 워크플로우 분기
- Executor Panel에서 JavaScript 코드를 입력해 Input Data를 가공해 값 boolean 반환
- true: "Yes" 경로, false: "No" 경로
- Properties panel에서 Conditions를 추가해 포트 분기 처리(boolean값을 이용해 Yes or No 포트로 분기 처리) 가능
- JavaScript 코드를 입력해 Input Data를 가공해 Output Data를 Return 가능

### Service Node (서비스 노드)
- 외부 API 호출 등 서비스 연동
- API, Database, Webhook 등
- 비동기 처리 지원
- Executor Panel에서 JavaScript 코드를 입력해 Input Data를 가공해 Output Data 반환

## Executor 함수

### 개념

각 Task, Service, Decision 노드는 JavaScript로 작성된 Executor 함수를 가질 수 있습니다. 이 함수는 부모 노드의 출력을 입력으로 받아 처리합니다.

### 함수 시그니처

**Task/Service 노드:**
```javascript
// inputData: 부모 노드의 출력 데이터
// 반환값: 다음 노드로 전달할 데이터

return {
  ...inputData,
  timestamp: Date.now(),
};
```

**Decision 노드:**
```javascript
// inputData: 부모 노드의 출력 데이터
// 반환값: boolean (true = Yes, false = No)

return inputData && inputData.value > 100;
```

### 사용 가능한 API

- `inputData`: 부모 노드의 데이터
- `fetch`: HTTP 요청
- 표준 JavaScript: Math, Date, JSON, Array, Object 등

### 예제

**API 호출:**
```javascript
const response = await fetch('https://api.example.com/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(inputData),
});
return await response.json();
```

**데이터 변환:**
```javascript
return {
  id: inputData.id,
  fullName: `${inputData.firstName} ${inputData.lastName}`,
  age: new Date().getFullYear() - inputData.birthYear,
};
```

**유효성 검증:**
```javascript
return inputData.email && inputData.email.includes('@');
```

### 보안 고려사항

⚠️ **중요:**
- Executor는 `Function` 생성자를 사용하여 컴파일됩니다
- 신뢰할 수 있는 사용자만 접근할 수 있는 환경에서 사용하세요
- 내부 도구, 프로토타입, 개발 워크플로우에 적합
- 공개 애플리케이션에서는 추가 샌드박싱 필요

**현재 보안 조치:**
- ✅ 30초 실행 타임아웃
- ✅ Try-catch 에러 처리
- ✅ 격리된 스코프
- ✅ 제한된 API (inputData + fetch만)

## 기술 스택

- **React 19** - UI 라이브러리
- **TypeScript** - 타입 안전성
- **Vite** - 빠른 개발 및 빌드
- **react-cosmos-diagram** - 노드 기반 다이어그램
- **@dnd-kit** - 드래그 앤 드롭
- **Tailwind CSS** - 스타일링
- **Zustand** - 상태 관리
- **Lucide React** - 아이콘

## 프로젝트 구조

```
src/
├── components/
│   ├── Nodes/              # 노드 컴포넌트 (Start, End, Task, Decision, Service)
│   ├── Edges/              # 엣지 컴포넌트
│   ├── NodeTemplatePanel/  # 노드 템플릿 패널
│   └── ...
├── contexts/               # React Context (ExecutorEditor, PropertiesPanel 등)
├── pages/
│   └── workflow/           # 메인 워크플로우 페이지
├── types/                  # TypeScript 타입 정의
├── utils/                  # 유틸리티 함수
├── fixtures/               # Mock 데이터
└── constants/              # 상수 (색상 팔레트 등)
```

## 개발 정보

### 커밋 컨벤션

프로젝트는 Husky를 사용하여 커밋 메시지 형식을 강제합니다.

**형식:** `<Type>: <message>`

**사용 가능한 Type:**
- `Feat`: 새로운 기능
- `Fix`: 버그 수정
- `Docs`: 문서 변경
- `Style`: 코드 포맷팅
- `Refactor`: 리팩토링
- `Test`: 테스트 코드
- `Chore`: 빌드 설정, 패키지 업데이트
- `Design`: UI/CSS 변경

### Pre-commit Hook

커밋 전에 자동으로 ESLint가 실행되어 코드 품질을 검사합니다.

## 라이선스

Private

---

*React, TypeScript, Vite로 구축된 비주얼 워크플로우 빌더*
