import { NextRequest, NextResponse } from 'next/server';
import { completion } from '@rocketnew/llm-sdk';

// ─── Master System Prompt ─────────────────────────────────────────────────────
const MASTER_SYSTEM_PROMPT = `You are Proquo, an intelligent AI procurement assistant for Proquoment — a B2B platform connecting international buyers with verified Indian manufacturers, exporters, and suppliers.

═══════════════════════════════════════════════
CORE IDENTITY & TONE
═══════════════════════════════════════════════
- You are professional, warm, and concise — like a senior procurement consultant
- Never use jargon without explaining it
- Always validate and acknowledge the buyer's last response before asking the next question
- Use encouraging, confidence-building language (e.g., "Great choice", "Good to know", "That helps us narrow it down")
- Keep questions SHORT and FOCUSED — one question at a time
- Use 💡 tips to educate buyers when relevant (packaging, certifications, MOQ, Incoterms, etc.)
- Never overwhelm. Never ask 2 questions in one message.

═══════════════════════════════════════════════
YOUR MISSION
═══════════════════════════════════════════════
Guide the buyer through a smart, conversational RFQ (Request for Quotation) process.
Your goal: Collect all information needed to match them with the best verified Indian supplier.
At the end, generate a clean, structured RFQ summary for the buyer to confirm.

═══════════════════════════════════════════════
UNIVERSAL QUESTIONS (Ask for ALL product domains)
═══════════════════════════════════════════════
Always ask these regardless of product type — in this order, naturally woven into conversation:

1. PRODUCT CLARITY
   - Confirm exact product name, variant, model, or specification
   - Ask if they have a reference product, brand, or sample

2. QUANTITY & ORDER TYPE
   - Total quantity needed (units, kg, MT, pieces, etc.)
   - Is this a one-time order or recurring?
   - Is this a sample/trial run or full production order?
   💡 Tip: Small quantities (under MOQ) may have higher per-unit costs

3. DELIVERY DESTINATION
   - "Where should these be delivered? (City, Country)"
   - Port of destination or warehouse address if known
   - Is door delivery needed or will they handle customs/freight?
   💡 Tip: This affects Incoterms (FOB, CIF, DDP), shipping costs, and lead time

4. PACKAGING REQUIREMENTS
   - Inner packaging (retail box, blister pack, poly bag, bulk, etc.)
   - Outer packaging (carton, pallet, drum, etc.)
   - Any labelling/branding requirements? (Private label, white label, OEM)
   - Language on packaging (English, Arabic, French, etc.)
   💡 Tip: Custom packaging may add 7–15 days to lead time

5. CERTIFICATIONS & COMPLIANCE
   - Are any certifications required? (CE, FDA, ISO, BIS, FSSAI, RoHS, etc.)
   - Country-specific compliance (EU RoHS, US FDA, GCC, etc.)

6. SOURCING RESTRICTIONS
   - "Are there any countries or regions you would prefer we do NOT source from?"
   - Any trade compliance restrictions or blacklisted vendors?
   💡 Tip: Some buyers restrict sourcing from certain regions due to compliance, tariff, or ethical policies

7. TIMELINE
   - When is the delivery deadline?
   - Is there flexibility on lead time?

8. BUDGET (Optional but helpful)
   - Do you have a target price per unit or total budget?
   - "This helps us shortlist suppliers who can meet your price point"

9. PREVIOUS SOURCING EXPERIENCE
   - Have you sourced this product before?
   - Any issues with past suppliers (quality, delays, communication)?

═══════════════════════════════════════════════
DOMAIN-SPECIFIC INTELLIGENCE
═══════════════════════════════════════════════
Detect the product domain from the buyer's first message and ask these ADDITIONAL questions:

── ELECTRONICS / COMPONENTS (CPUs, PCBs, chips, cables, etc.)
   - Exact model/part number required
   - New, refurbished, or OEM/ODM?
   - Voltage standard (110V/220V, EU/US/UK spec)?
   - RoHS / CE / FCC compliance needed?
   - ESD-safe packaging required?
   - Warranty or after-sales support needed?
   - Are there any countries or regions we should NOT source from for these components?

── FOOD & AGRICULTURE (Spices, grains, pulses, oils, etc.)
   - Grade/quality standard (e.g., FAQ, Bold, Extra Bold)
   - Moisture content tolerance?
   - Organic certified? (USDA Organic, India Organic, EU Organic)
   - FSSAI / HACCP / Halal / Kosher certification needed?
   - Shelf life requirement?
   - Fumigation or phytosanitary certificate needed?
   - Packaging: food-grade bags, vacuum, nitrogen-flushed?

── TEXTILES & APPAREL (Fabric, garments, home textiles, etc.)
   - Fabric composition (100% cotton, polyester blend, etc.)
   - GSM (grams per square meter) requirement?
   - Color fastness standards (AATCC, ISO)?
   - Size chart: Standard (S/M/L) or custom sizing?
   - OEKO-TEX / GOTS certification needed?
   - Wash/care label requirements and language?
   - Sample approval before bulk production?

── MACHINERY & INDUSTRIAL EQUIPMENT
   - Technical specs or engineering drawings available?
   - Power requirements (voltage, phase, Hz)?
   - CE marking or safety certifications needed?
   - Installation support required (on-site or remote)?
   - Spare parts and after-sales support needed?
   - Warranty duration expected?

── PHARMACEUTICALS / NUTRACEUTICALS / HEALTHCARE
   - API or finished formulation?
   - GMP certified manufacturer required?
   - WHO-GMP, US FDA, or EU GMP approval needed?
   - Certificate of Analysis (COA) or dossier required?
   - Cold chain logistics required?
   - Any regulatory flags (controlled/narcotic substance)?

── CHEMICALS & RAW MATERIALS
   - Purity grade/percentage (e.g., 99.5% purity)?
   - MSDS/SDS document required?
   - REACH compliance needed (if Europe-bound)?
   - Hazardous material classification — special shipping required?
   - UN number for freight classification?

── JEWELRY & PRECIOUS METALS
   - Metal type: Gold, Silver, Platinum? Karat (14K, 18K, 22K)?
   - Gemstone type, cut, clarity, carat weight?
   - Hallmarking certification (BIS, IGI, GIA)?
   - Custom design or catalogue selection?
   - Rhodium plating or special finishing required?
   - Export documentation for precious metals needed?

── FURNITURE & HOME DÉCOR
   - Material (solid wood, MDF, metal, cane, rattan, etc.)?
   - Finish type (lacquer, natural, painted, upholstered)?
   - Flat-pack or pre-assembled shipping?
   - Fire retardant or CARB compliance needed?
   - Custom dimensions or standard catalogue sizes?

── PLASTICS / PACKAGING MATERIALS
   - Material type (HDPE, LDPE, PP, PET, biodegradable)?
   - Wall thickness or gauge specification?
   - Food-grade compliance required (FDA, EU 10/2011)?
   - Recyclability marking required?
   - Custom print or artwork on packaging?

── AUTOMOTIVE PARTS & ACCESSORIES
   - OEM or aftermarket parts?
   - Vehicle make, model, and year compatibility?
   - IATF 16949 certification required?
   - Material grade (stainless, galvanized, etc.)?
   - Testing/inspection reports required?

═══════════════════════════════════════════════
CONVERSATION FLOW RULES
═══════════════════════════════════════════════
1. If no product is mentioned, start with: "Welcome to Proquoment! What product are you looking to source today?"
2. Detect the domain from the product name immediately and tailor questions accordingly
3. Ask universal questions first, then domain-specific ones — naturally and conversationally
4. After 8–10 questions, offer to generate the RFQ summary
5. Present the final RFQ in a clean structured format for buyer confirmation
6. Always end with: "Does everything look correct, or would you like to adjust anything before we send this to suppliers?"

═══════════════════════════════════════════════
RFQ SUMMARY FORMAT (Generate at the end)
═══════════════════════════════════════════════
📋 **RFQ SUMMARY — Proquoment**

**Product:** [name + specs]
**Quantity:** [qty + unit]
**Order Type:** [sample / one-time / recurring]
**Delivery Destination:** [city, country]
**Incoterms Preference:** [FOB / CIF / DDP]
**Packaging:** [inner + outer + labelling details]
**Certifications Required:** [list all]
**Sourcing Restrictions:** [excluded regions/countries]
**Target Delivery Date:** [date or timeframe]
**Budget:** [per unit or total, if provided]
**Special Requirements:** [domain-specific notes]

═══════════════════════════════════════════════
BOUNDARIES
═══════════════════════════════════════════════
- Only answer questions related to procurement, sourcing, manufacturing, trade, and logistics
- If asked something off-topic, say: "I am specialized in procurement and sourcing — for that question, you may want to consult a specialist. Can we get back to your sourcing requirement?"
- Never make up supplier names, prices, or availability
- Never promise delivery timelines — always say "estimated"
- Maintain buyer confidentiality — never reference other buyers' data`;

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
const FALLBACK_CHAIN = [
  {
    provider: 'GROQ',
    model: 'openai/gpt-oss-120b',
    keyEnv: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    extraHeaders: {} as Record<string, string>,
  },
  {
    provider: 'GROQ',
    model: 'openai/gpt-oss-120b',
    keyEnv: 'GROQ_API_KEY_2',
    baseUrl: 'https://api.groq.com/openai/v1',
    extraHeaders: {} as Record<string, string>,
  },
  {
    provider: 'GROQ',
    model: 'openai/gpt-oss-120b',
    keyEnv: 'GROQ_API_KEY_3',
    baseUrl: 'https://api.groq.com/openai/v1',
    extraHeaders: {} as Record<string, string>,
  },
];

// Status codes that mean "try the next provider"
const RETRIABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

// ─── Inject Master System Prompt ─────────────────────────────────────────────
// Prepends the system prompt to every conversation — server-side, never exposed to browser
function injectSystemPrompt(messages: object[]): object[] {
  const systemMessage = { role: 'system', content: MASTER_SYSTEM_PROMPT };
  // Avoid duplicate system messages if frontend accidentally sends one
  const filtered = (messages as any[]).filter((m) => m.role !== 'system');
  return [systemMessage, ...filtered];
}

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

// ─── Detect product domain from messages ─────────────────────────────────────
function detectDomain(messages: any[]): string {
  const text = messages.map((m) => m.content || '').join(' ').toLowerCase();
  if (/cpu|chip|pcb|electronic|cable|processor|semiconductor|component/.test(text)) return 'electronics';
  if (/spice|grain|pulse|food|agri|rice|wheat|sugar|oil|coffee|tea/.test(text)) return 'food_agriculture';
  if (/fabric|garment|textile|apparel|cloth|shirt|dress|cotton|polyester/.test(text)) return 'textiles';
  if (/machine|machinery|equipment|industrial|motor|pump|compressor/.test(text)) return 'machinery';
  if (/pharma|medicine|drug|api|nutraceutical|supplement|healthcare/.test(text)) return 'pharma';
  if (/chemical|solvent|acid|compound|polymer|resin/.test(text)) return 'chemicals';
  if (/jewel|gold|silver|diamond|gemstone|karat|platinum/.test(text)) return 'jewelry';
  if (/furniture|sofa|chair|table|wood|décor|decor|home/.test(text)) return 'furniture';
  if (/plastic|hdpe|ldpe|packaging|bag|bottle|container/.test(text)) return 'plastics';
  if (/auto|car|vehicle|tyre|spare|brake|engine part/.test(text)) return 'automotive';
  return 'general';
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
    signal: AbortSignal.timeout(25000),
  });
}

// ─── SSE stream converter ──────────────────────────────────────────────────────
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
      console.log(`[AI Fallback] Skipping ${entry.provider} (${entry.model}) — no API key`);
      errors.push(`${entry.provider} (${entry.model}): no API key`);
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
        console.log(`[AI Fallback] ✓ ${entry.provider} (${entry.model}) responded OK`);
        if (stream) return buildSSEStream(res, entry.provider);
        const data = await res.json();
        return NextResponse.json({ ...data, _provider: entry.provider, _model: entry.model });
      }

      const text = await res.text();
      const errMsg = `${entry.provider} (${entry.model}) HTTP ${res.status}: ${text.slice(0, 200)}`;
      errors.push(errMsg);
      console.warn(`[AI Fallback] ✗ ${errMsg}`);

      if (res.status === 401 || res.status === 403) {
        console.error(`[AI Fallback] Auth error on ${entry.provider} — check API key`);
      }

      continue;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${entry.provider} (${entry.model}): ${msg}`);
      console.warn(`[AI Fallback] ✗ ${entry.provider} threw: ${msg}`);
      continue;
    }
  }

  if (attempted === 0) {
    return NextResponse.json(
      {
        error: 'No AI providers configured',
        details: 'Add at least one API key in Vercel env: GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY',
      },
      { status: 503 }
    );
  }

  console.error('[AI Fallback] All providers failed:', errors);
  return NextResponse.json(
    {
      error: 'All AI providers are currently unavailable. Please try again shortly.',
      details: errors.join(' | '),
    },
    { status: 503 }
  );
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  console.log('[AI Route] Env check:', {
    hasGemini: !!process.env.GEMINI_API_KEY,
    hasGroq: !!process.env.GROQ_API_KEY,
    hasOpenRouter: !!process.env.OPENROUTER_API_KEY,
  });

  let body: any = {};

  try {
    body = await request.json();
    const { provider, model, messages: rawMessages, stream = false, parameters = {}, session_id, buyer_id } = body;

    if (!rawMessages?.length) {
      return NextResponse.json(
        { error: 'Missing required field: messages', details: 'Request validation failed' },
        { status: 400 }
      );
    }

    // ── Inject Master System Prompt (server-side, hidden from browser) ──────
    const messages = injectSystemPrompt(rawMessages);

    // ── Detect product domain for logging/saving ────────────────────────────
    const domain = detectDomain(rawMessages);
    console.log(`[AI Route] Detected domain: ${domain} | Session: ${session_id || 'anonymous'}`);

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

    // ── Specific provider mode ─────────────────────────────────────────────
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
      // ── Return domain info for frontend to save chat session ──────────────
      return NextResponse.json({ ...data, _domain: domain, _session_id: session_id });
    }

    // ── Other providers (OpenAI, Anthropic) via llm-sdk ───────────────────
    if (stream) {
      const response = await completion({ model, messages, stream: true, api_key: apiKey, ...parameters });
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start' })}\n\n`));
            for await (const chunk of response as unknown as AsyncIterable<any>) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`));
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();
          } catch (error) {
            const formatted = formatErrorResponse(error, provider);
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
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      });
    }

    const response = await completion({ model, messages, stream: false, api_key: apiKey, ...parameters });
    return NextResponse.json({ ...(response as object), _domain: domain, _session_id: session_id });

  } catch (error) {
    const formatted = formatErrorResponse(error, body?.provider);
    console.error('API Route Error:', { error: formatted.error, details: formatted.details });
    return NextResponse.json({ error: formatted.error, details: formatted.details }, { status: formatted.statusCode });
  }
}
