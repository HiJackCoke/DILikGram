# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DILikGram is a React-based workflow builder application that visualizes and executes workflow diagrams. It uses `react-cosmos-diagram` for interactive node-based workflow visualization with support for multiple node types, edge connections, and workflow execution simulation.

## Development Commands

```bash
# Install dependencies
npm install

# Development server (runs on port 3000, auto-opens browser)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Lint and auto-fix
npm run lint-fix
```

## Architecture

### Core Libraries

- **react-cosmos-diagram**: Main diagramming library for node-based workflow visualization
- **zustand**: State management (if needed for global state)
- **lucide-react**: Icon library
- **vite-react-routes**: File-based routing system (pages in `src/pages/`)
- **Tailwind CSS**: Styling framework with custom palette system

### Path Alias

The project uses `@/` as an alias for `/src/` directory (configured in vite.config.ts).

### Project Structure

```
src/
├── components/
│   ├── Modal/          # Generic Modal system components
│   │   ├── index.tsx   # Modal controller with animation states
│   │   ├── Portal.tsx  # React Portal wrapper with scroll blocking
│   │   ├── View.tsx    # Modal presentation with backdrop
│   │   └── types.ts    # TypeScript type definitions
│   ├── ExecutorEditor/ # Executor editor specific components
│   │   ├── ExecutorEditorModal.tsx    # Modal composition (Modal + Content)
│   │   └── ExecutorEditorContent.tsx  # Editor logic and UI
│   ├── Nodes/          # Workflow node components (StartNode, EndNode, TaskNode, DecisionNode, ServiceNode)
│   └── Edges/          # Custom edge components and utilities
├── contexts/           # React Context providers
│   └── ExecutorEditorContext.tsx  # ExecutorEditorProvider with modal state management
├── pages/              # File-based routing (managed by vite-react-routes)
│   └── workflow/       # Main workflow builder page
├── types/
│   ├── nodes.ts        # Node type definitions with WorkflowNodeState
│   └── edges.ts        # Edge type definitions with WorkflowEdgeData
├── utils/
│   ├── flowHighlight.ts      # Flow path highlighting logic for selected nodes
│   └── workflowExecution.ts  # WorkflowExecutor class for simulating execution
├── fixtures/           # Mock data for nodes and edges
└── constants/
    └── palette.ts      # Color palette exported to Tailwind config
```

### Key Architectural Concepts

#### 1. Node System

The application supports 5 node types defined in `src/types/nodes.ts`:

- **StartNode**: Entry point of workflow
- **EndNode**: Exit point with status (success/failure/neutral)
- **TaskNode**: General work items with description, assignee, status
- **DecisionNode**: Branching logic (yes/no ports)
- **ServiceNode**: External service calls (API, database, webhook, etc.)

All nodes share a common `WorkflowNodeState` which includes:

- `highlighted`: Whether the node is part of the selected flow path
- `dimmed`: Whether the node should be dimmed (not in selected path)
- `executionState`: Runtime state (idle/executing/executed)

#### 2. Workflow Execution System

The execution system (`src/utils/workflowExecution.ts`) uses a `WorkflowExecutor` class that:

- Simulates workflow execution with 1-second delays per node
- Supports two execution modes: "success" and "failure" for decision branching
- Tracks execution state (current node, executed nodes, active edges)
- Provides abort capability via AbortController
- Animates edges during traversal

Decision nodes automatically select branches based on execution mode:

- Success mode follows "yes" edges
- Failure mode follows "no" edges

#### 3. Flow Highlighting System

The highlighting system (`src/utils/flowHighlight.ts`) provides:

- `findFlowPath()`: Calculates all ancestors and descendants of selected nodes
- Highlights connected subgraph when a node is selected
- Dims unrelated nodes/edges for focus
- Handles branching logic: decision nodes highlight all branches, other nodes highlight only their direct path

#### 4. Parent-Child Node Relationships

Nodes use `parentNode` property to establish hierarchical relationships:

- Edges don't define parent-child; the `parentNode` field does
- This enables proper flow traversal and execution order
- Decision nodes can have multiple children (branches)

#### 5. Color Palette System

The project uses a centralized palette (`src/constants/palette.ts`) exported to Tailwind:

- Primary (blue): Task nodes, default ports
- Success (green): Start nodes, success paths
- Danger (red): Failure paths, error states
- Warning (yellow): Decision nodes, warning edges
- Secondary (purple): Service nodes
- Neutral (gray): Default edges, target ports

Access colors in components via `palette-{category}-{property}` (e.g., `bg-palette-success-bg`).

#### 6. React Cosmos Diagram Integration

The main workflow page (`src/pages/workflow/index.tsx`) demonstrates:

- Custom node/edge types registration via `nodeTypes` and `edgeTypes`
- State management with `useNodesState` and `useEdgesState` hooks
- Store access with `useStore` for resetting selections
- Node/edge enhancement pattern: wrap original data with computed properties (highlighted, dimmed, executionState)

#### 7. Portal-Based Modal System

The application uses a modular, React Portal-based modal system for managing UI overlays like the executor editor.

**Architecture: Generic Modal + Context**

The modal system is built with three layers of separation:

1. **Generic Modal Components** (`src/components/Modal/`)
   - `Modal` - Controller with animation state machine
   - `Portal` - React Portal wrapper with scroll blocking
   - `View` - Presentation layer with backdrop
   - `types.ts` - TypeScript interfaces

2. **Specific Modal Implementations** (`src/components/ExecutorEditor/`)
   - `ExecutorEditorModal` - Composition of Modal + ExecutorEditorContent
   - `ExecutorEditorContent` - Editor-specific logic and UI

3. **State Management** (`src/contexts/ExecutorEditorContext.tsx`)
   - Context Provider manages modal state
   - Renders modal inside Provider tree
   - Provides `open()` and `close()` functions

**Why Portal + Context?**

This pattern provides modularity and reusability:

- ✅ **Reusable Modal** - Generic Modal can be used for any modal/dialog
- ✅ **Separation of Concerns** - Modal logic separated from content
- ✅ **React Patterns** - Uses standard Context API and Hooks
- ✅ **Animation Support** - Built-in open/close animations via state machine
- ✅ **TypeScript Safety** - Full type checking for props and context
- ✅ **Easy Testing** - Can test Modal, Content, and Context independently

**The Pattern:**

```typescript
// 1. Generic Modal Component (src/components/Modal/index.tsx)
export function Modal({ open, onClose, children }: ModalProps) {
  const [visible, setVisible] = useState<boolean | null>(null);
  const [isCleared, setIsCleared] = useState(true);

  // Animation state machine: null → true → false → null
  // Portal renders only when !isCleared

  return (
    <Portal clearDOM={isCleared}>
      {!isCleared && (
        <ModalView $open={visible} onClose={onClose}>
          {children}
        </ModalView>
      )}
    </Portal>
  );
}

// 2. Specific Modal Composition (src/components/ExecutorEditor/ExecutorEditorModal.tsx)
export default function ExecutorEditorModal({
  isOpen,
  nodeId,
  nodeType,
  initialConfig,
  onSave,
  onClose,
}: ExecutorEditorModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose}>
      <ExecutorEditorContent
        nodeId={nodeId}
        nodeType={nodeType}
        initialConfig={initialConfig}
        onSave={onSave}
        onClose={onClose}
      />
    </Modal>
  );
}

// 3. Context Provider (src/contexts/ExecutorEditorContext.tsx)
export function ExecutorEditorProvider({ children, nodes, onSave }) {
  const [state, setState] = useState<ExecutorEditorState>({
    isOpen: false,
    nodeId: null,
    nodeType: null,
  });

  const open = (nodeId: string, nodeType: NodeType) => {
    const currentNode = nodes.find((n) => n.id === nodeId);
    setState({
      isOpen: true,
      nodeId,
      nodeType,
      initialConfig: currentNode?.data?.executor?.config,
    });
  };

  return (
    <ExecutorEditorContext.Provider value={{ open, close }}>
      {children}
      {state.isOpen && state.nodeId && (
        <ExecutorEditorModal key={state.nodeId} {...state} onSave={handleSave} onClose={close} />
      )}
    </ExecutorEditorContext.Provider>
  );
}

// 4. WorkflowPage Setup
<ExecutorEditorProvider nodes={nodes} onSave={handleExecutorSave}>
  <div id="modal-root" /> {/* Portal target */}
  <ReactDiagram ... />
</ExecutorEditorProvider>

// 5. Usage in Node Components
import { useExecutorEditorContext } from "@/contexts/ExecutorEditorContext";

export function TaskNode({ id }: TaskNodeProps) {
  const { open } = useExecutorEditorContext();

  const handleOpenEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    open(id, "task");
  };

  return <button onClick={handleOpenEditor}>...</button>;
}
```

**Animation State Machine:**

The Modal uses a two-state system for smooth animations:

1. `visible` - Controls CSS transitions (null → true → false → null)
2. `isCleared` - Controls Portal rendering (prevents flash on mount)

**State Flow:**

- **Opening**: `visible: null → true`, `isCleared: false`
- **Open**: `visible: true`, `isCleared: false`
- **Closing**: `visible: false`, wait 300ms for animation
- **Closed**: `visible: null`, `isCleared: true`

**Benefits:**

- **Modularity**: Generic Modal can be reused for confirm dialogs, alerts, etc.
- **Composition**: Easy to create new modals by composing Modal + Content
- **Standard React**: Uses Context API, Hooks, and Portal patterns
- **Clean Props**: Each layer has focused, minimal props
- **Easy Styling**: Modal, backdrop, and content styling separated
- **Type Safety**: Full TypeScript support throughout

## Commit Convention

This project enforces commit message format via Husky hook (`.husky/prepare-commit-msg`).

**Required Format**: `<Type>: <message>`

**Valid Types**:

- `Feat`: New feature
- `Fix`: Bug fix
- `Docs`: Documentation changes
- `Style`: Code formatting (no logic changes)
- `Refactor`: Code refactoring
- `Test`: Test code
- `Chore`: Build config, project setup, package updates
- `Design`: UI/CSS changes
- `Add`: Simple code additions
- `Rename`: File/folder renames
- `Remove`: File deletions
- `Clean`: Remove unnecessary code (console.logs, etc.)
- `Type`: TypeScript type modifications
- `Example`: Example code/pages

The hook automatically prepends an emoji to commits (✨ for Feat, 🚑 for Fix, etc.).

**Pre-commit Hook**: Runs `lint-staged` which applies ESLint with auto-fix to staged `.ts/.tsx` files.

## ESLint Configuration

- Uses TypeScript ESLint with React Hooks and React Refresh plugins
- Unused variables are warnings, not errors (`@typescript-eslint/no-unused-vars: warn`)
- Ignores `dist/` directory

## Important Notes

- The workflow execution is simulated (1-second delays) - not connected to real backend
- Node positioning and layout is managed by the diagram library
- The main application entry uses file-based routing via `vite-react-routes`
