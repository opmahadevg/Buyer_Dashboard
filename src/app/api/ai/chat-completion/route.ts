import { NextRequest, NextResponse } from 'next/server';
import { completion } from '@rocketnew/llm-sdk';

// ─── API Keys ─────────────────────────────────────────────────────────────────
const API_KEYS: Record<string, string | undefined> = {
  OPEN_AI: process.env.OPENAI_API_KEY,
  ANTHROPIC: process.env.ANTHROPIC_API_KEY,
  GEMINI: process.env.GEMINI_API_KEY,
  PERPLEXITY: process.env.PERPLEXITY_API_KEY,
  GROQ: process.env.GROQ_API_KEY,
  OPENROUTER: process.env.OPENROUTER_API_KEY,
};

// ─── Fallback Chain ────────────────────────────────────────────────────────────
// Providers are tried in order. First one that responds OK wins.
// Add/remove/reorder entries to change priority.
import { NextRequest, NextResponse } from 'next/server';
import { completion } from '@rocketnew/llm-sdk';

// ─── API Keys ─────────────────────────────────────────────────────────────────
const API_KEYS: Record<string, string | undefined> = {
  OPEN_AI: process.env.OPENAI_API_KEY,
  ANTHROPIC: process.env.ANTHROPIC_API_KEY,
  GEMINI: process.env.GEMINI_API_KEY,
  PERPLEXITY: process.env.PERPLEXITY_API_KEY,
  GROQ: process.env.GROQ_API_KEY,
  OPENROUTER: process.env.OPENROUTER_API_KEY,
};

// ─── Fallback Chain ────────────────────────────────────────────────────────────
// Providers are tried in order. First one that responds OK wins.
// Add/remove/reorder entries to change priority.
const FALLBACK_CHAIN = [
  {
    provider: 'GEMINI',
    model: 'gemini-1.5-flash',
    keyEnv: 'GEMINI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    extraHeaders: {} as Record<string, string>,
  },
  {
    provider: 'GROQ',
    model: 'llama-3.3-70b-versatile',
    keyEnv: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    extraHeaders: {} as Record<string, string>,
  },
  {
    provider: 'OPENROUTER',
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    keyEnv: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1',
    extraHeaders: {
      'HTTP-Referer': 'https://buyer-dashboard-silk.vercel.app',
      'X-Title': 'Proquoment',
    },
  },
];

// Status codes that mean "try the next provider"
const RETRIABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatErrorResponse(error: unknown, provider?: string) {
  const statusCode = (error as any)?.statusCode || (error as any)?.status || 500;
  const providerName = (error as any)?.llmProvider || provider || 'Unknown';
  return {
    error: `${providerName.toUpperCase()} API error: ${statusCode}`,
    details: error instanceof Error ? error.message : String(error),
    statusCode,
  };
}

function stripModelPrefix(model: string) {
  return model.replace(/^(groq|gemini|openrouter|openai|anthropic)\//, '');
}

// ─── OpenAI-compatible fetch ───────────────────────────────────────────────────
async function callOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: object[],
  stream: boolean,
  parameters: Record<string, unknown>,
  extraHeaders: Record<string, string> = {}
): Promise<Response> {
  return fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({ model, messages, stream, ...parameters }),
  });
}

// ─── SSE stream converter ──────────────────────────────────────────────────────
// Converts any OpenAI-compatible SSE stream into our internal SSE format.
function buildSSEStream(providerResponse: Response, providerName: string): NextResponse {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', provider: providerName })}\n\n`));

        const reader = providerResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'chunk', chunk: { choices: [{ delta: { content: delta } }] } })}\n\n`
                  )
                );
              }
            } catch {
              // skip malformed chunk
            }
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        controller.close();
      } catch (err) {
        const formatted = formatErrorResponse(err, providerName);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', error: formatted.error, details: formatted.details })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// ─── AUTO fallback handler ────────────────────────────────────────────────────
// Tries each provider in FALLBACK_CHAIN until one succeeds.
async function handleAutoFallback(
  messages: object[],
  stream: boolean,
  parameters: Record<string, unknown>
): Promise<NextResponse> {
  const errors: string[] = [];
  let attempted = 0;

  for (const entry of FALLBACK_CHAIN) {
    const apiKey = process.env[entry.keyEnv];
    if (!apiKey) {
      console.log(`[AI Fallback] Skipping ${entry.provider} — no API key configured`);
      continue;
    }

    attempted++;
    try {
      console.log(`[AI Fallback] Trying ${entry.provider} (${entry.model})…`);
      const res = await callOpenAICompat(
        entry.baseUrl,
        apiKey,
        entry.model,
        messages,
        stream,
        parameters,
        entry.extraHeaders
      );

      if (res.ok) {
        console.log(`[AI Fallback] ✓ ${entry.provider} responded OK`);
        if (stream) return buildSSEStream(res, entry.provider);
        const data = await res.json();
        return NextResponse.json({ ...data, _provider: entry.provider });
      }

      const text = await res.text();
      const errMsg = `${entry.provider} HTTP ${res.status}: ${text.slice(0, 300)}`;
      errors.push(errMsg);
      console.warn(`[AI Fallback] ✗ ${errMsg}`);

      // A 400 from GROQ often means quota/token exhaustion — check the body before giving up
      const isQuotaOrTokenError = /token|quota|limit|exceed|too.large|context|capacity|overload/i.test(text);
      const isRetriable = RETRIABLE_STATUSES.has(res.status) || (res.status === 400 && isQuotaOrTokenError);

      if (!isRetriable) {
        // Genuine bad request (wrong params) — retrying another provider won't help
        break;
      }
      // Retriable — continue to next provider
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${entry.provider} threw: ${msg}`);
      console.warn(`[AI Fallback] ✗ ${entry.provider} threw: ${msg}`);
    }
  }

  if (attempted === 0) {
    return NextResponse.json(
      { error: 'No AI providers configured', details: 'Add at least one of: GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY' },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { error: 'All AI providers unavailable', details: errors.join(' | ') },
    { status: 503 }
  );
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let body: any = {};

  try {
    body = await request.json();
    const { provider, model, messages, stream = false, parameters = {} } = body;

    if (!messages?.length) {
      return NextResponse.json(
        { error: 'Missing required field: messages', details: 'Request validation failed' },
        { status: 400 }
      );
    }

    // ── AUTO mode: try providers in fallback order ──────────────────────────
    if (!provider || provider === 'AUTO') {
      return handleAutoFallback(messages, stream, parameters);
    }

    if (!model) {
      return NextResponse.json(
        { error: 'Missing required field: model', details: 'Request validation failed' },
        { status: 400 }
      );
    }

    // ── Specific provider mode (backward-compatible) ───────────────────────
    const apiKey = API_KEYS[provider];
    if (!apiKey) {
      return NextResponse.json(
        {
          error: `${provider.toUpperCase()} API key is not configured`,
          details: 'The API key for this provider is missing in environment variables',
        },
        { status: 400 }
      );
    }

    // GROQ, GEMINI, OPENROUTER — all OpenAI-compatible
    if (['GROQ', 'GEMINI', 'OPENROUTER'].includes(provider)) {
      const entry = FALLBACK_CHAIN.find((e) => e.provider === provider);
      const baseUrl = entry?.baseUrl || 'https://api.groq.com/openai/v1';
      const extraHeaders = entry?.extraHeaders || {};
      const bareModel = stripModelPrefix(model);

      const res = await callOpenAICompat(baseUrl, apiKey, bareModel, messages, stream, parameters, extraHeaders);

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({ error: `${provider} API error: ${res.status}`, details: text }, { status: res.status });
      }

      if (stream) return buildSSEStream(res, provider);
      const data = await res.json();
      return NextResponse.json(data);
    }

    // Other providers (OpenAI, Anthropic, etc.) — use llm-sdk
    if (stream) {
      const response = await completion({ model, messages, stream: true, api_key: apiKey, ...parameters });
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start' })}\n\n`));
            for await (const chunk of response as unknown as AsyncIterable<unknown>) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`));
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();
          } catch (error) {
            const formatted = formatErrorResponse(error, provider);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: formatted.error, details: formatted.details })}\n\n`));
            controller.close();
          }
        },
      });
      return new NextResponse(readable, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      });
    }

    const response = await completion({ model, messages, stream: false, api_key: apiKey, ...parameters });
    return NextResponse.json(response);
  } catch (error) {
    const formatted = formatErrorResponse(error, body?.provider);
    console.error('API Route Error:', { error: formatted.error, details: formatted.details });
    return NextResponse.json({ error: formatted.error, details: formatted.details }, { status: formatted.statusCode });
  }
}

// Status codes that mean "try the next provider"
const RETRIABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatErrorResponse(error: unknown, provider?: string) {
  const statusCode = (error as any)?.statusCode || (error as any)?.status || 500;
  const providerName = (error as any)?.llmProvider || provider || 'Unknown';
  return {
    error: `${providerName.toUpperCase()} API error: ${statusCode}`,
    details: error instanceof Error ? error.message : String(error),
    statusCode,
  };
}

function stripModelPrefix(model: string) {
  return model.replace(/^(groq|gemini|openrouter|openai|anthropic)\//, '');
}

// ─── OpenAI-compatible fetch ───────────────────────────────────────────────────
async function callOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: object[],
  stream: boolean,
  parameters: Record<string, unknown>,
  extraHeaders: Record<string, string> = {}
): Promise<Response> {
  return fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({ model, messages, stream, ...parameters }),
  });
}

// ─── SSE stream converter ──────────────────────────────────────────────────────
// Converts any OpenAI-compatible SSE stream into our internal SSE format.
function buildSSEStream(providerResponse: Response, providerName: string): NextResponse {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', provider: providerName })}\n\n`));

        const reader = providerResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'chunk', chunk: { choices: [{ delta: { content: delta } }] } })}\n\n`
                  )
                );
              }
            } catch {
              // skip malformed chunk
            }
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        controller.close();
      } catch (err) {
        const formatted = formatErrorResponse(err, providerName);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', error: formatted.error, details: formatted.details })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// ─── AUTO fallback handler ────────────────────────────────────────────────────
// Tries each provider in FALLBACK_CHAIN until one succeeds.
async function handleAutoFallback(
  messages: object[],
  stream: boolean,
  parameters: Record<string, unknown>
): Promise<NextResponse> {
  const errors: string[] = [];
  let attempted = 0;

  for (const entry of FALLBACK_CHAIN) {
    const apiKey = process.env[entry.keyEnv];
    if (!apiKey) {
      console.log(`[AI Fallback] Skipping ${entry.provider} — no API key configured`);
      continue;
    }

    attempted++;
    try {
      console.log(`[AI Fallback] Trying ${entry.provider} (${entry.model})…`);
      const res = await callOpenAICompat(
        entry.baseUrl,
        apiKey,
        entry.model,
        messages,
        stream,
        parameters,
        entry.extraHeaders
      );

      if (res.ok) {
        console.log(`[AI Fallback] ✓ ${entry.provider} responded OK`);
        if (stream) return buildSSEStream(res, entry.provider);
        const data = await res.json();
        return NextResponse.json({ ...data, _provider: entry.provider });
      }

      const text = await res.text();
      const errMsg = `${entry.provider} HTTP ${res.status}: ${text.slice(0, 300)}`;
      errors.push(errMsg);
      console.warn(`[AI Fallback] ✗ ${errMsg}`);

      // A 400 from GROQ often means quota/token exhaustion — check the body before giving up
      const isQuotaOrTokenError = /token|quota|limit|exceed|too.large|context|capacity|overload/i.test(text);
      const isRetriable = RETRIABLE_STATUSES.has(res.status) || (res.status === 400 && isQuotaOrTokenError);

      if (!isRetriable) {
        // Genuine bad request (wrong params) — retrying another provider won't help
        break;
      }
      // Retriable — continue to next provider
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${entry.provider} threw: ${msg}`);
      console.warn(`[AI Fallback] ✗ ${entry.provider} threw: ${msg}`);
    }
  }

  if (attempted === 0) {
    return NextResponse.json(
      { error: 'No AI providers configured', details: 'Add at least one of: GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY' },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { error: 'All AI providers unavailable', details: errors.join(' | ') },
    { status: 503 }
  );
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let body: any = {};

  try {
    body = await request.json();
    const { provider, model, messages, stream = false, parameters = {} } = body;

    if (!messages?.length) {
      return NextResponse.json(
        { error: 'Missing required field: messages', details: 'Request validation failed' },
        { status: 400 }
      );
    }

    // ── AUTO mode: try providers in fallback order ──────────────────────────
    if (!provider || provider === 'AUTO') {
      return handleAutoFallback(messages, stream, parameters);
    }

    if (!model) {
      return NextResponse.json(
        { error: 'Missing required field: model', details: 'Request validation failed' },
        { status: 400 }
      );
    }

    // ── Specific provider mode (backward-compatible) ───────────────────────
    const apiKey = API_KEYS[provider];
    if (!apiKey) {
      return NextResponse.json(
        {
          error: `${provider.toUpperCase()} API key is not configured`,
          details: 'The API key for this provider is missing in environment variables',
        },
        { status: 400 }
      );
    }

    // GROQ, GEMINI, OPENROUTER — all OpenAI-compatible
    if (['GROQ', 'GEMINI', 'OPENROUTER'].includes(provider)) {
      const entry = FALLBACK_CHAIN.find((e) => e.provider === provider);
      const baseUrl = entry?.baseUrl || 'https://api.groq.com/openai/v1';
      const extraHeaders = entry?.extraHeaders || {};
      const bareModel = stripModelPrefix(model);

      const res = await callOpenAICompat(baseUrl, apiKey, bareModel, messages, stream, parameters, extraHeaders);

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({ error: `${provider} API error: ${res.status}`, details: text }, { status: res.status });
      }

      if (stream) return buildSSEStream(res, provider);
      const data = await res.json();
      return NextResponse.json(data);
    }

    // Other providers (OpenAI, Anthropic, etc.) — use llm-sdk
    if (stream) {
      const response = await completion({ model, messages, stream: true, api_key: apiKey, ...parameters });
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start' })}\n\n`));
            for await (const chunk of response as unknown as AsyncIterable<unknown>) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`));
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();
          } catch (error) {
            const formatted = formatErrorResponse(error, provider);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: formatted.error, details: formatted.details })}\n\n`));
            controller.close();
          }
        },
      });
      return new NextResponse(readable, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      });
    }

    const response = await completion({ model, messages, stream: false, api_key: apiKey, ...parameters });
    return NextResponse.json(response);
  } catch (error) {
    const formatted = formatErrorResponse(error, body?.provider);
    console.error('API Route Error:', { error: formatted.error, details: formatted.details });
    return NextResponse.json({ error: formatted.error, details: formatted.details }, { status: formatted.statusCode });
  }
}
