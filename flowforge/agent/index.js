/**
 * ForgeAgent entry point
 * ES module — works on GitHub Pages & Netlify without build step.
 *
 * Usage:
 *   import { initAgent } from './agent/index.js';
 *   initAgent();
 */

import { Agent } from './core/Agent.js';
import { AgentPanel } from './ui/AgentPanel.js';
import { AGENT_VERSION } from './config.js';

let agent = null;
let panel = null;

export function initAgent(options = {}) {
  if (agent) return { agent, panel };

  agent = new Agent(options);
  panel = new AgentPanel(agent);
  panel.mount();

  // Expose for debugging / external control
  window.ForgeAgent = {
    version: AGENT_VERSION,
    agent,
    panel,
    open: () => panel.show(),
    run: (text) => agent.run(text),
    toolCount: () => agent.getToolCount(),
  };

  console.info(
    `%c⚡ ForgeAgent v${AGENT_VERSION} ready · ${agent.getToolCount()} tools`,
    'color:#89b4fa;font-weight:bold'
  );

  return { agent, panel };
}

export { Agent, AgentPanel, AGENT_VERSION };

// Auto-init when loaded as script type=module after DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAgent());
  } else {
    // Delay slightly so app.js globals (S, draw, ...) exist
    setTimeout(() => initAgent(), 100);
  }
}