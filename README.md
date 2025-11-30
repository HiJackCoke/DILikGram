# DILikGram - Workflow Builder

A visual workflow builder powered by React, TypeScript, and [react-cosmos-diagram](https://github.com/yourusername/react-cosmos-diagram). Build and execute custom workflows with UI-configurable JavaScript executor functions.

## Features

- 🎨 **Visual Workflow Designer**: Drag-and-drop interface for building workflows
- ⚙️ **Custom Executors**: Configure each node with custom JavaScript functions
- 🔄 **Real-time Execution**: Watch data flow through your workflow in real-time
- 📊 **Execution Statistics**: Track completed nodes, errors, and execution time
- 🎯 **Decision Nodes**: Dynamic branching based on custom evaluation logic
- 🔗 **Data Flow Visualization**: See data transfer between nodes with animated edges
- ⏱️ **Async Support**: Full support for async/await and fetch API calls
- 🛡️ **Error Handling**: Comprehensive error catching with timeout protection

## Executor Functions

### Overview

Each Task, Service, and Decision node can have a custom JavaScript executor function that transforms input data to output data.

### Configuration

1. Click the ⚙️ Settings button on any node (green indicator shows when configured)
2. Enter your JavaScript code in the editor
3. Async functions are automatically detected (look for the "Async Detected" badge)
4. Test with sample input
5. Save

### Function Signature

**Task/Service Nodes:**

```javascript
// Receives: nodeInput (from parent node)
// Returns: output data (any type)

// Example: Transform data
return {
  ...nodeInput,

  timestamp: Date.now(),
};
```

**Decision Nodes:**

```javascript
// Receives: nodeInput (from parent node)
// Returns: boolean (true = Yes path, false = No path)

// Example: Validate data
return nodeInput && nodeInput.value > 100;
```

### Available APIs

- `nodeInput`: Data from parent node
- `fetch`: HTTP requests to external APIs (async automatically detected)
- Standard JavaScript: Math, Date, JSON, Array, Object, etc.

**Note:** Async functions are automatically detected by analyzing your code for patterns like `await`, `async`, `.then()`, or `new Promise()`. No need to manually specify!

### Examples

**API Call:**

```javascript
const response = await fetch("https://api.example.com/process", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(nodeInput),
});
return await response.json();
```

**Data Transformation:**

```javascript
return {
  id: nodeInput.id,
  fullName: `${nodeInput.firstName} ${nodeInput.lastName}`,
  age: new Date().getFullYear() - nodeInput.birthYear,
};
```

**Validation:**

```javascript
return nodeInput.email && nodeInput.email.includes("@");
```

### Security Considerations

⚠️ **Important Security Notes:**

- Executors use JavaScript's `Function` constructor for code compilation
- Only use this tool with trusted users in controlled environments
- Suitable for internal tools, prototypes, and development workflows
- **Not recommended** for public-facing applications without additional sandboxing

**Mitigations in place:**

- ✅ 30-second execution timeout
- ✅ Try-catch error handling
- ✅ Isolated scope (no closure access)
- ✅ Limited API surface (nodeInput + fetch only)

**Future enhancements** (not yet implemented):

- Web Workers for true sandboxing
- Rate limiting for fetch calls
- Memory usage monitoring
- Code linting and validation

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Testing

See [TESTING.md](./TESTING.md) for comprehensive testing guidelines.

## Tech Stack

- **React 19** with TypeScript
- **Vite** for fast development and building
- **react-cosmos-diagram** for node-based visualization
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Lucide React** for icons

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/vitejs/vite-plugin-react/issues/428) for tracking the progress.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
