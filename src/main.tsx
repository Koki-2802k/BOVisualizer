import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const originalWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  const message = args.map((arg) => String(arg)).join(" ");
  if (message.includes("THREE.Clock: This module has been deprecated")) {
    return;
  }
  originalWarn(...args);
};

void import('./App.tsx').then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
