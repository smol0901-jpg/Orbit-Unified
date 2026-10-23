/** OpenAI-compatible provider (also used by Grok, DeepSeek, custom) */

export async function chatOpenAI({
  baseUrl,
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
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream,
  };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 300)}`);
  }

  if (!stream) {
    const data = await res.json();
    return normalizeOpenAI(data);
  }

  // Streaming
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
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const chunk = JSON.parse(payload);
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          full += delta.content;
          onChunk?.(delta.content);
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCalls[idx]) toolCalls[idx] = { id: tc.id || '', function: { name: '', arguments: '' } };
            if (tc.id) toolCalls[idx].id = tc.id;
            if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }
      } catch { /* ignore partial */ }
    }
  }

  return {
    content: full,
    tool_calls: toolCalls.filter(Boolean),
    usage: null,
    model,
  };
}

function normalizeOpenAI(data) {
  const choice = data.choices?.[0];
  const msg = choice?.message || {};
  return {
    content: msg.content || '',
    tool_calls: msg.tool_calls || [],
    usage: data.usage || null,
    model: data.model,
    finish_reason: choice?.finish_reason,
  };
}