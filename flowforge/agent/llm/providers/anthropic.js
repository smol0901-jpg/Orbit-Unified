/** Anthropic Claude provider */

export async function chatAnthropic({
  apiKey,
  model,
  messages,
  tools,
  temperature = 0.35,
  maxTokens = 4096,
  stream = false,
  onChunk,
  signal,
}) {
  // Convert OpenAI-style messages to Anthropic
  let system = '';
  const anthMessages = [];
  for (const m of messages) {
    if (m.role === 'system') {
      system += (system ? '\n\n' : '') + m.content;
    } else if (m.role === 'tool') {
      anthMessages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }],
      });
    } else if (m.role === 'assistant' && m.tool_calls?.length) {
      const content = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      for (const tc of m.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || '{}'),
        });
      }
      anthMessages.push({ role: 'assistant', content });
    } else {
      anthMessages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    }
  }

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: anthMessages,
    stream,
  };
  if (system) body.system = system;
  if (tools?.length) {
    body.tools = tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 300)}`);
  }

  if (!stream) {
    const data = await res.json();
    return normalizeAnthropic(data);
  }

  // Streaming SSE
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let toolCalls = [];
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === 'content_block_delta' && ev.delta?.text) {
          full += ev.delta.text;
          onChunk?.(ev.delta.text);
        }
        if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use') {
          toolCalls.push({
            id: ev.content_block.id,
            function: { name: ev.content_block.name, arguments: '' },
          });
        }
        if (ev.type === 'content_block_delta' && ev.delta?.partial_json) {
          const last = toolCalls[toolCalls.length - 1];
          if (last) last.function.arguments += ev.delta.partial_json;
        }
      } catch { /* ignore */ }
    }
  }

  return { content: full, tool_calls: toolCalls, usage: null, model };
}

function normalizeAnthropic(data) {
  let content = '';
  const tool_calls = [];
  for (const block of data.content || []) {
    if (block.type === 'text') content += block.text;
    if (block.type === 'tool_use') {
      tool_calls.push({
        id: block.id,
        function: { name: block.name, arguments: JSON.stringify(block.input || {}) },
      });
    }
  }
  return {
    content,
    tool_calls,
    usage: data.usage,
    model: data.model,
    finish_reason: data.stop_reason,
  };
}