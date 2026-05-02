'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import toast, { Toaster } from 'react-hot-toast';
import { useChat } from '@/lib/hooks/useChat';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import ChatButton from '@/components/ui/ChatButton';
import { ArrowRight, Eye, EyeOff, ArrowUp, Loader2, CheckCircle, ChevronRight, Paperclip } from 'lucide-react';
import { saveProduct } from '@/lib/productStore';

// ─── Types ───────────────────────────────────────────────────────────────────
type Step = 'intro' | 'transition' | 'choose' | 'builder';

interface Message {
  id: string;
  role: 'ai' | 'user';
  text: string;
  options?: string[];
  isStreaming?: boolean;
}

interface RFQData {
  productName: string;
  category: string;
  intendedUse: string;
  description: string;
  moq: string;
  specifications: { label: string; value: string; pending?: boolean }[];
  manufacturingNotes: { label: string; value: string; pending?: boolean }[];
  ambiguities: string[];
}

// ─── System prompt for conversational text (NO JSON) ─────────────────────────
const CHAT_SYSTEM_PROMPT = `You are a precision procurement RFQ agent for Proquoment, a B2B sourcing platform. Help the buyer build a complete, manufacturer-ready RFQ through intelligent, focused questions.

RESPONSE FORMAT — follow this structure exactly every time:
1. One short sentence confirming or acknowledging the last answer (skip on first message).
2. **Bold question** — the single most important missing specification.
3. Bullet list of 3–4 options in this exact format:
   • **Option Name** – brief explanation or example with real numbers/units
   • **Option Name** – brief explanation or example with real numbers/units
4. Optional: 💡 One concise tip about cost, quality, or certification impact.
5. REQUIRED final line: OPTIONS: option1, option2, option3, option4

BEHAVIOR:
- Read the product description carefully. Skip any spec already provided.
- Ask ONE question per turn. Every option must include real numbers (mm, g/m², units, $, days).
- Cover in this priority order (skip if already known):
  a. Exact dimensions — L × W × H in mm/cm, or diameter × height
  b. MOQ — minimum order quantity in units
  c. Target price per unit (USD)
  d. Material grade/weight — e.g. 300 g/m², 0.8 mm steel, food-grade PP
  e. Colorways — number of Pantone/RAL colors or print type
  f. Packaging — units per carton, poly bag or box
  g. Manufacturing tolerance — ±mm
  h. Lead time — days from purchase order
  i. Required certifications — CE, FDA, OEKO-TEX, RoHS, etc.
- After 7–9 exchanges say: "Perfect, I have everything I need to build your RFQ." then:
  OPTIONS: Yes, finalize RFQ, Add one more detail

CRITICAL RULES:
- NEVER output raw JSON or code blocks.
- The OPTIONS: line is machine-parsed and NOT shown to the user — always include it.
- Keep the confirmation sentence to 1 line max before the bold question.
- Bold option names: **Name** — then dash and description.
- Use realistic, product-specific numbers — never vague words like "small/medium/large" alone.

EXAMPLE (for a ceramic plate):
Got it, high-fire stoneware it is.

**What diameter and height do you need for the plate?**
• **24 cm diameter, 2.5 cm height** – standard dinner plate, most common for retail
• **26 cm diameter, 3 cm height** – slightly larger, popular for restaurants
• **28 cm diameter, 3.5 cm height** – large format, premium presentation
• **Custom dimensions** – specify in the box below

💡 Diameter above 26 cm may increase kiln space requirements and unit cost by 10–15%.

OPTIONS: 24 cm diameter, 26 cm diameter, 28 cm diameter, Custom / Type below`;

// ─── System prompt for structured JSON extraction (NO conversational text) ───
const JSON_SYSTEM_PROMPT = `You are a data extraction agent. Based on the conversation provided, extract all known product details and return ONLY a valid JSON object. No explanations, no text, no markdown — just the raw JSON object.

The JSON must have this exact structure:
{
  "productName": "string",
  "category": "string",
  "intendedUse": "string",
  "description": "string",
  "moq": "string",
  "specifications": [
    { "label": "Dimensions (L × W × H)", "value": "string", "pending": boolean },
    { "label": "Materials / Grade", "value": "string", "pending": boolean },
    { "label": "Unit Weight", "value": "string", "pending": boolean },
    { "label": "Target Unit Price", "value": "string", "pending": boolean },
    { "label": "Colorways / Finish", "value": "string", "pending": boolean },
    { "label": "Packaging", "value": "string", "pending": boolean },
    { "label": "Branding / Labeling", "value": "string", "pending": boolean },
    { "label": "Surface Treatment / Coating", "value": "string", "pending": boolean },
    { "label": "Certifications / Standards", "value": "string", "pending": boolean }
  ],
  "manufacturingNotes": [
    { "label": "Production Process", "value": "string", "pending": boolean },
    { "label": "Dimensional Tolerances", "value": "string", "pending": boolean },
    { "label": "Lead Time (days)", "value": "string", "pending": boolean },
    { "label": "Quality / Testing Requirements", "value": "string", "pending": boolean }
  ],
  "ambiguities": ["string"],
  "options": ["string"]
}

Rules:
- Always include units in values: mm, cm, g, kg, g/m², days, USD, %, etc.
- For numeric ranges confirmed by the buyer, write exactly what they said (e.g. "500–1,000 units", "30×20×10 cm", "±0.5 mm", "$5–$15/unit", "45–60 days").
- Use "(Pending)" as value and set pending: true for any field not yet discussed.
- Never reset a field that was already confirmed — preserve all prior answers.
- The ambiguities array should list only genuinely unknown items.
- The options array should contain 2–4 short strings for quick-reply buttons matching the next question's choices, otherwise [].
- Return ONLY the JSON object. Nothing else.`;

const EMPTY_RFQ: RFQData = {
  productName: '',
  category: '',
  intendedUse: '',
  description: '',
  moq: '',
  specifications: [
    { label: 'Dimensions (L × W × H)', value: '(Pending)', pending: true },
    { label: 'Materials / Grade', value: '(Pending)', pending: true },
    { label: 'Unit Weight', value: '(Pending)', pending: true },
    { label: 'Target Unit Price', value: '(Pending)', pending: true },
    { label: 'Colorways / Finish', value: '(Pending)', pending: true },
    { label: 'Packaging', value: '(Pending)', pending: true },
    { label: 'Branding / Labeling', value: '(Pending)', pending: true },
    { label: 'Surface Treatment / Coating', value: '(Pending)', pending: true },
    { label: 'Certifications / Standards', value: '(Pending)', pending: true },
  ],
  manufacturingNotes: [
    { label: 'Production Process', value: '(Pending)', pending: true },
    { label: 'Dimensional Tolerances', value: '(Pending)', pending: true },
    { label: 'Lead Time (days)', value: '(Pending)', pending: true },
    { label: 'Quality / Testing Requirements', value: '(Pending)', pending: true },
  ],
  ambiguities: [],
};

// ─── Parse options from conversational text ───────────────────────────────────
function extractOptionsFromText(text: string): { cleanText: string; options: string[] } {
  const optionsMatch = text.match(/OPTIONS:\s*(.+)$/m);
  if (!optionsMatch) return { cleanText: text.trim(), options: [] };
  const options = optionsMatch[1].split(',').map((o) => o.trim()).filter(Boolean);
  const cleanText = text.replace(/OPTIONS:\s*.+$/m, '').trim();
  return { cleanText, options };
}

// ─── Decorative crescent dot-pattern SVG ─────────────────────────────────────
function CrescentDots({ size = 220, rotate = 0, opacity = 1 }: { size?: number; rotate?: number; opacity?: number }) {
  const dots: React.ReactNode[] = [];
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.46;
  const innerR = size * 0.28;
  const dotR = size * 0.018;
  const spacing = dotR * 2.6;

  for (let x = 0; x < size; x += spacing) {
    for (let y = 0; y < size; y += spacing) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const shiftX = innerR * 0.55;
      const dx2 = x - (cx + shiftX);
      const dy2 = y - cy;
      const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (dist <= outerR && dist2 > innerR * 0.9) {
        dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={dotR} fill="#3B35E8" opacity={0.55} />);
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: `rotate(${rotate}deg)`, opacity }}>
      {dots}
    </svg>
  );
}

// ─── World map dot pattern ────────────────────────────────────────────────────
function WorldMapDots() {
  const mapData = [
    ...Array.from({ length: 40 }, (_, i) => ({ x: 120 + (i % 8) * 18, y: 80 + Math.floor(i / 8) * 18 })),
    ...Array.from({ length: 30 }, (_, i) => ({ x: 130 + (i % 6) * 18, y: 170 + Math.floor(i / 6) * 18 })),
    ...Array.from({ length: 20 }, (_, i) => ({ x: 200 + (i % 4) * 18, y: 280 + Math.floor(i / 4) * 18 })),
    ...Array.from({ length: 25 }, (_, i) => ({ x: 440 + (i % 5) * 18, y: 80 + Math.floor(i / 5) * 18 })),
    ...Array.from({ length: 30 }, (_, i) => ({ x: 450 + (i % 5) * 18, y: 200 + Math.floor(i / 5) * 18 })),
    ...Array.from({ length: 60 }, (_, i) => ({ x: 560 + (i % 10) * 18, y: 80 + Math.floor(i / 10) * 18 })),
    ...Array.from({ length: 40 }, (_, i) => ({ x: 580 + (i % 8) * 18, y: 200 + Math.floor(i / 8) * 18 })),
    ...Array.from({ length: 15 }, (_, i) => ({ x: 700 + (i % 5) * 18, y: 320 + Math.floor(i / 5) * 18 })),
  ];
  const supplierDots = [
    { x: 720, y: 180 }, { x: 740, y: 200 }, { x: 760, y: 190 }, { x: 780, y: 210 },
    { x: 800, y: 185 }, { x: 820, y: 200 }, { x: 840, y: 175 }, { x: 860, y: 195 },
    { x: 750, y: 220 }, { x: 770, y: 230 }, { x: 790, y: 215 }, { x: 810, y: 225 },
    { x: 300, y: 200 }, { x: 320, y: 210 }, { x: 340, y: 195 },
    { x: 460, y: 120 }, { x: 480, y: 130 }, { x: 500, y: 115 },
  ];

  return (
    <svg viewBox="0 0 1200 500" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {mapData.map((d, i) => <circle key={`land-${i}`} cx={d.x} cy={d.y} r={3} fill="#e5e7f0" />)}
      {supplierDots.map((d, i) => <circle key={`sup-${i}`} cx={d.x} cy={d.y} r={4} fill="#3B35E8" />)}
    </svg>
  );
}

// ─── Category quick-chips ─────────────────────────────────────────────────────
const CATEGORY_CHIPS = [
  { label: '👕 Apparel & Textiles', value: 'Apparel or textile product' },
  { label: '🪑 Furniture', value: 'Furniture product' },
  { label: '🍶 Ceramics & Homeware', value: 'Ceramic or homeware product' },
  { label: '⚙️ Industrial Parts', value: 'Industrial or mechanical part' },
  { label: '📦 Packaging', value: 'Packaging material or box' },
  { label: '💄 Beauty & Personal Care', value: 'Beauty or personal care product' },
  { label: '🔌 Electronics', value: 'Electronic component or device' },
  { label: '🧴 Food & Beverage', value: 'Food or beverage product' },
];

// ─── Step 1: Intro ────────────────────────────────────────────────────────────
function IntroStep({ onNext }: { onNext: (product: string) => void }) {
  const [value, setValue] = useState('');

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      <div className="absolute top-6 left-8">
        <Link href="/products-list" className="flex items-center gap-1.5 text-sm text-[var(--foreground)] hover:text-primary transition-colors">
          <span className="text-base">‹</span> Back to Home
        </Link>
      </div>
      <div className="absolute right-[8%] top-[5%] pointer-events-none"><CrescentDots size={200} rotate={-15} opacity={0.9} /></div>
      <div className="absolute right-[22%] top-[38%] pointer-events-none"><CrescentDots size={160} rotate={10} opacity={0.85} /></div>
      <div className="absolute right-[5%] top-[42%] pointer-events-none"><CrescentDots size={180} rotate={-5} opacity={0.8} /></div>

      <div className="flex flex-col justify-center min-h-screen px-16 max-w-3xl">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-3 leading-tight">
          What product are we sourcing today?
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mb-6">Pick a category or describe your product below.</p>

        {/* Category chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {CATEGORY_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setValue((prev) => prev ? prev : chip.value)}
              className="px-3.5 py-2 text-sm border border-[var(--border)] rounded-full hover:border-primary hover:bg-[var(--secondary)] hover:text-primary transition-all duration-150 text-[var(--foreground)] bg-white"
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-[var(--border)] rounded-2xl shadow-sm p-6 mb-4 focus-within:border-primary/50 transition-colors">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. Ceramic plate, 26 cm diameter, high-fire stoneware, glossy white food-safe glaze with cobalt blue rim. 2000 units."
            className="w-full h-28 resize-none text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none bg-transparent leading-relaxed"
          />
        </div>
        <p className="text-xs text-[var(--muted-foreground)] italic mb-7">
          More detail = better manufacturer matches. Don't worry — the AI will ask follow-up questions.
        </p>
        <button
          onClick={() => value.trim() && onNext(value.trim())}
          disabled={!value.trim()}
          className="flex items-center gap-2 px-7 py-3.5 bg-primary text-white rounded-full text-base font-semibold w-fit hover:bg-[#2e29c4] active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start <ArrowRight size={18} />
        </button>
      </div>
      <ChatButton />
    </div>
  );
}

// ─── Step 2: Transition ───────────────────────────────────────────────────────
function TransitionStep({ productText, onNext }: { productText: string; onNext: () => void }) {
  const productName = deriveProductName(productText);

  useEffect(() => {
    const t = setTimeout(onNext, 2800);
    return () => clearTimeout(t);
  }, [onNext]);

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      <div className="absolute top-6 left-8">
        <Link href="/products-list" className="flex items-center gap-1.5 text-sm text-[var(--foreground)] hover:text-primary transition-colors">
          <span className="text-base">‹</span> Back to Home
        </Link>
      </div>
      <div className="absolute inset-0 flex items-center justify-end pr-0">
        <div className="w-[65%] h-[70%] opacity-80"><WorldMapDots /></div>
      </div>
      <div className="relative flex flex-col justify-center min-h-screen px-16 max-w-2xl">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-6">Perfect! Let&apos;s dive in</h1>
        <p className="text-lg text-[var(--foreground)] mb-4 leading-relaxed">
          Finding manufacturers for: <span className="text-primary font-semibold">{productName}</span>
        </p>
        <p className="text-lg text-[var(--foreground)] leading-relaxed">
          Nice - I&apos;ve already found <span className="text-primary font-bold text-xl">165</span> suppliers that could be a great fit
        </p>
        <div className="flex gap-1.5 mt-8">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
      <ChatButton />
    </div>
  );
}

// ─── Step 3: Choose RFQ method ────────────────────────────────────────────────
const RFQ_OPTIONS = [
  {
    id: 'complete',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="1" width="13" height="17" rx="2" stroke="#3B35E8" strokeWidth="1.5" />
        <path d="M7 6h6M7 9h6M7 12h4" stroke="#3B35E8" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 15l2 2 4-4" stroke="#3B35E8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'I have a complete RFQ',
    description: 'Upload your RFQ and supporting documents',
  },
  {
    id: 'partial',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="1" width="13" height="17" rx="2" stroke="#3B35E8" strokeWidth="1.5" />
        <path d="M7 6h6M7 9h4" stroke="#3B35E8" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="16" cy="16" r="4" stroke="#3B35E8" strokeWidth="1.5" />
        <path d="M16 14v2l1 1" stroke="#3B35E8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'I have partial details',
    description: "Upload what you have, and we'll help fill in the gaps",
  },
  {
    id: 'scratch',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="9" stroke="#3B35E8" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M11 7v4l3 3" stroke="#3B35E8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: "I\'m starting from scratch",
    description: 'Build your RFQ with guided questions',
  },
];

function ChooseStep({ onNext }: { onNext: (method: string) => void }) {
  return (
    <div className="relative min-h-screen bg-white">
      <div className="absolute top-6 left-8">
        <Link href="/products-list" className="flex items-center gap-1.5 text-sm text-[var(--foreground)] hover:text-primary transition-colors">
          <span className="text-base">‹</span> Back to Home
        </Link>
      </div>
      <div className="flex flex-col justify-center min-h-screen px-16 max-w-3xl">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-10">
          Choose how you want to build your RFQ
        </h1>
        <div className="space-y-4">
          {RFQ_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onNext(opt.id)}
              className="w-full flex items-center gap-5 px-6 py-5 bg-[var(--muted)]/50 hover:bg-[var(--secondary)] border border-[var(--border)] hover:border-primary/30 rounded-xl transition-all duration-150 group text-left"
            >
              <div className="flex-shrink-0">{opt.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)] mb-0.5">{opt.title}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{opt.description}</p>
              </div>
              <ArrowRight size={18} className="text-primary flex-shrink-0 group-hover:translate-x-1 transition-transform" />
            </button>
          ))}
        </div>
      </div>
      <ChatButton />
    </div>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-3 mb-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce"
          style={{ animationDelay: `${i * 120}ms`, animationDuration: '0.8s' }}
        />
      ))}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, onOptionClick, isLoading }: { msg: Message; onOptionClick: (opt: string) => void; isLoading: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (opt: string) => {
    if (isLoading || selected) return;
    setSelected(opt);
    onOptionClick(opt);
  };

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end mb-6">
        <div className="bg-[#F0F0F2] text-[#0D0D14] text-sm px-4 py-2 rounded-2xl max-w-[70%] leading-relaxed">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-7">
      {/* AI message body — plain prose, no bubble */}
      {msg.isStreaming && !msg.text ? (
        <TypingIndicator />
      ) : (
        <div className="text-[15px] text-[#0D0D14] leading-[1.7] prose prose-sm max-w-none
          prose-p:my-1.5 prose-p:text-[15px] prose-p:text-[#0D0D14]
          prose-strong:font-semibold prose-strong:text-[#0D0D14]
          prose-ul:my-2 prose-ul:space-y-1.5 prose-li:text-[15px] prose-li:text-[#0D0D14] prose-li:my-0
          [&_li]:list-none [&_ul]:pl-0">
          <ReactMarkdown>{msg.text}</ReactMarkdown>
        </div>
      )}

      {/* Quick-reply chips — only on last non-streaming message */}
      {!msg.isStreaming && msg.options && msg.options.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {msg.options.map((opt, idx) => {
            const isSelected = selected === opt;
            return (
              <button
                key={`${idx}-${opt}`}
                onClick={() => handleSelect(opt)}
                disabled={isLoading || !!selected}
                className={`px-3.5 py-1.5 rounded-full border text-sm font-medium transition-all duration-150 disabled:cursor-not-allowed
                  ${isSelected
                    ? 'bg-[#0D0D14] border-[#0D0D14] text-white'
                    : selected
                      ? 'border-gray-200 text-gray-300 bg-white'
                      : 'border-gray-300 text-[#0D0D14] bg-white hover:border-[#0D0D14] hover:bg-[#F5F5F8]'
                  }`}
              >
                {isSelected && <CheckCircle size={12} className="inline mr-1.5 -mt-0.5" />}
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── RFQ Panel ────────────────────────────────────────────────────────────────
function RFQPanel({ rfq, rfqTitle, finalized, isLoading, onFinalize }: {
  rfq: RFQData;
  rfqTitle: string;
  finalized: boolean;
  isLoading: boolean;
  onFinalize: () => void;
}) {
  const allSpecs = rfq.specifications;
  const allNotes = rfq.manufacturingNotes;
  const totalFields = allSpecs.length + allNotes.length + 5;
  const filledFields =
    allSpecs.filter((s) => !s.pending).length +
    allNotes.filter((n) => !n.pending).length +
    (rfq.productName ? 1 : 0) + (rfq.category ? 1 : 0) +
    (rfq.intendedUse ? 1 : 0) + (rfq.description ? 1 : 0) + (rfq.moq ? 1 : 0);
  const completionPct = Math.round((filledFields / totalFields) * 100);

  const hasBasicInfo = rfq.productName || rfq.category || rfq.intendedUse || rfq.description || rfq.moq;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Panel header */}
      <div className="px-7 pt-7 pb-5 border-b border-gray-100">
        <h2 className="text-lg font-bold text-[#0D0D14] leading-snug mb-1">
          {rfqTitle || 'New Product RFQ'}
        </h2>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0D0D14] rounded-full transition-all duration-700"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-[#0D0D14] tabular-nums">{completionPct}%</span>
        </div>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7 text-sm">

        {/* Basic info */}
        {hasBasicInfo ? (
          <div className="space-y-2">
            {rfq.productName && <InfoRow label="Product Name" value={rfq.productName} bold />}
            {rfq.category && <InfoRow label="Category" value={rfq.category} />}
            {rfq.intendedUse && <InfoRow label="Intended Use / Function" value={rfq.intendedUse} />}
            {rfq.description && <InfoRow label="Product Description" value={rfq.description} />}
            {rfq.moq && <InfoRow label="MOQ" value={rfq.moq} />}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">
            Product details will appear here as the conversation progresses…
          </p>
        )}

        {/* Specifications */}
        <div>
          <p className="text-xs font-bold text-[#0D0D14] uppercase tracking-widest mb-3">Specifications:</p>
          <ul className="space-y-2">
            {allSpecs.map((spec, i) => (
              <li key={i} className="flex items-baseline gap-1.5 text-sm leading-snug">
                <span className="text-gray-400 flex-shrink-0">•</span>
                {spec.pending ? (
                  <span className="text-gray-400 italic">{spec.label}: (Pending)</span>
                ) : (
                  <span className="text-[#0D0D14]"><span className="font-semibold">{spec.label}:</span> {spec.value}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Manufacturing Notes */}
        <div>
          <p className="text-xs font-bold text-[#0D0D14] uppercase tracking-widest mb-3">Manufacturing Notes:</p>
          <ul className="space-y-2">
            {allNotes.map((note, i) => (
              <li key={i} className="flex items-baseline gap-1.5 text-sm leading-snug">
                <span className="text-gray-400 flex-shrink-0">•</span>
                {note.pending ? (
                  <span className="text-gray-400 italic">{note.label}: (Pending)</span>
                ) : (
                  <span className="text-[#0D0D14]"><span className="font-semibold">{note.label}:</span> {note.value}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Ambiguities */}
        {rfq.ambiguities.length > 0 && (
          <div>
            <p className="text-xs font-bold text-[#0D0D14] uppercase tracking-widest mb-3">Ambiguities / Pending Clarifications:</p>
            <ul className="space-y-1.5">
              {rfq.ambiguities.map((item, i) => (
                <li key={i} className="flex items-baseline gap-1.5 text-sm text-gray-500">
                  <span className="flex-shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Finalize button */}
      <div className="px-7 py-5 border-t border-gray-100">
        <button
          onClick={onFinalize}
          disabled={finalized || isLoading || (!rfq.productName && !rfqTitle)}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#0D0D14] text-white rounded-xl text-sm font-semibold hover:bg-[#1a1a26] active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {finalized ? (
            <><CheckCircle size={15} /> RFQ Finalized!</>
          ) : (
            <><ChevronRight size={15} /> Finalize &amp; Add to Products</>
          )}
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">
          Adds product to your sourcing list
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="text-sm leading-snug">
      <span className="font-semibold text-[#0D0D14]">{label}:</span>{' '}
      <span className={bold ? 'text-[#0D0D14] font-medium' : 'text-gray-600'}>{value}</span>
    </div>
  );
}

// ─── Step 4: RFQ Builder (Dual Gemini calls) ──────────────────────────────────
function BuilderStep({ productText, productName }: { productText: string; productName: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [rfqTitle, setRfqTitle] = useState(productName || 'New Product RFQ');
  const [rfq, setRfq] = useState<RFQData>({ ...EMPTY_RFQ });
  const [panelOpen, setPanelOpen] = useState(true);
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Streaming hook for conversational text only
  const { response: streamingResponse, isLoading: isStreaming, error: streamError, sendMessage: sendStreamingMessage } = useChat('GROQ', 'groq/llama-3.3-70b-versatile', true);

  // Show toast on error
  useEffect(() => {
    if (streamError) {
      const msg = streamError.message || '';
      if (msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('quota')) {
        toast.error('AI is busy — please wait a moment and try again.', { duration: 5000 });
      } else {
        toast.error(msg);
      }
    }
  }, [streamError]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update streaming AI message in real-time (text only, guaranteed clean)
  useEffect(() => {
    if (!streamingResponse) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.isStreaming) {
        const { cleanText } = extractOptionsFromText(streamingResponse);
        return [...prev.slice(0, -1), { ...last, text: cleanText }];
      }
      return prev;
    });
  }, [streamingResponse]);

  // When streaming completes: finalize message + fire separate JSON call (every other turn to reduce quota usage)
  const jsonCallCounterRef = useRef(0);
  useEffect(() => {
    if (!isStreaming && streamingResponse && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last?.isStreaming) {
        const { cleanText, options: inlineOptions } = extractOptionsFromText(streamingResponse);

        // Finalize the streaming message with clean text
        const finalMsg: Message = {
          ...last,
          text: cleanText,
          isStreaming: false,
          options: inlineOptions.length > 0 ? inlineOptions : undefined,
        };
        setMessages((prev) => [...prev.slice(0, -1), finalMsg]);

        // Add to conversation history
        const updatedHistory = [...conversationHistory, { role: 'assistant', content: cleanText }];
        setConversationHistory(updatedHistory);

        // Fire JSON extraction every other AI response to halve API usage
        jsonCallCounterRef.current += 1;
        if (jsonCallCounterRef.current % 2 === 1) {
          fireJsonExtractionCall(updatedHistory, finalMsg, inlineOptions);
        } else {
          // On skipped turns, still apply inline options if present
          if (inlineOptions.length > 0) {
            setMessages((prev) => {
              const l = prev[prev.length - 1];
              if (l?.id === finalMsg.id) {
                return [...prev.slice(0, -1), { ...l, options: inlineOptions }];
              }
              return prev;
            });
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  // Second Gemini call: extract structured JSON for RFQ panel (with retry on 429)
  const fireJsonExtractionCall = useCallback(async (
    history: { role: string; content: string }[],
    finalMsg: Message,
    inlineOptions: string[]
  ) => {
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 7000;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: 7s, 14s, 28s
          await new Promise((res) => setTimeout(res, BASE_DELAY_MS * Math.pow(2, attempt - 1)));
        }

        const jsonMessages = [
          { role: 'system', content: JSON_SYSTEM_PROMPT },
          ...history.map((h) => ({ role: h.role, content: h.content })),
          { role: 'user', content: 'Extract the current RFQ data from the conversation above as JSON.' },
        ];

        const result = await getChatCompletion('GROQ', 'groq/llama-3.3-70b-versatile', jsonMessages, {
          temperature: 0.1,
          max_tokens: 2048,
        });

        const rawContent: string = result?.choices?.[0]?.message?.content || '';

        // Parse JSON — strip any accidental markdown fences
        let jsonStr = rawContent.trim();
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        const parsed = JSON.parse(jsonStr);
        const { options: jsonOptions, ...rfqUpdate } = parsed;

        // Update RFQ panel
        setRfq((prev) => {
          const updated = { ...prev };
          if (rfqUpdate.productName) { updated.productName = rfqUpdate.productName; setRfqTitle(rfqUpdate.productName); }
          if (rfqUpdate.category) updated.category = rfqUpdate.category;
          if (rfqUpdate.intendedUse) updated.intendedUse = rfqUpdate.intendedUse;
          if (rfqUpdate.description) updated.description = rfqUpdate.description;
          if (rfqUpdate.moq) updated.moq = rfqUpdate.moq;
          if (rfqUpdate.specifications?.length) updated.specifications = rfqUpdate.specifications;
          if (rfqUpdate.manufacturingNotes?.length) updated.manufacturingNotes = rfqUpdate.manufacturingNotes;
          if (rfqUpdate.ambiguities) updated.ambiguities = rfqUpdate.ambiguities;
          return updated;
        });

        // If JSON call returned options and inline didn't have any, update the message
        const finalOptions = inlineOptions.length > 0 ? inlineOptions : (jsonOptions || []);
        if (finalOptions.length > 0 && inlineOptions.length === 0) {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.id === finalMsg.id) {
              return [...prev.slice(0, -1), { ...last, options: finalOptions }];
            }
            return prev;
          });
        }

        // Success — exit retry loop
        return;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isRateLimit = errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('quota');

        if (isRateLimit && attempt < MAX_RETRIES - 1) {
          // Will retry after backoff delay
          continue;
        }
        // Final attempt failed or non-rate-limit error — fail silently (chat still works)
      }
    }
  }, []);

  // Initialize conversation
  const initializeConversation = useCallback(() => {
    if (initialized || !productText) return;
    setInitialized(true);

    const userContent = `I want to source the following product: ${productText}`;
    const initialHistory = [{ role: 'user', content: userContent }];
    setConversationHistory(initialHistory);

    setMessages([{ id: 'user-init', role: 'user', text: productText }]);

    const aiMsgId = `ai-${Date.now()}`;
    setMessages((prev) => [...prev, { id: aiMsgId, role: 'ai', text: '', isStreaming: true }]);

    sendStreamingMessage(
      [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...initialHistory],
      { temperature: 0.7, max_tokens: 1024 }
    );
  }, [initialized, productText, sendStreamingMessage]);

  useEffect(() => {
    initializeConversation();
  }, [initializeConversation]);

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || isProcessing) return;

    const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');

    const newHistory = [...conversationHistory, { role: 'user', content: trimmed }];
    setConversationHistory(newHistory);

    const aiMsgId = `ai-${Date.now()}`;
    setMessages((prev) => [...prev, { id: aiMsgId, role: 'ai', text: '', isStreaming: true }]);

    sendStreamingMessage(
      [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...newHistory],
      { temperature: 0.7, max_tokens: 1024 }
    );
  };

  const handleFinalize = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const title = rfqTitle || rfq.productName || deriveProductName(productText);

    saveProduct({
      id: `prod-rfq-${Date.now()}`,
      name: title,
      category: rfq.category,
      description: rfq.description,
      moq: rfq.moq,
      specifications: rfq.specifications,
      manufacturingNotes: rfq.manufacturingNotes,
      status: 'New Update',
      stage: 'Quoting',
      updated: dateStr,
      image: '',
      imageAlt: `${title} product`,
    });

    setFinalized(true);
    toast.success('RFQ finalized! Product added to your list.');
    setTimeout(() => router.push('/products-list'), 1200);
  };

  const isDisabled = isStreaming || isProcessing;

  return (
    <div className="relative h-screen bg-white flex flex-col overflow-hidden">
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '13px', borderRadius: '10px', fontFamily: 'inherit' } }} />

      {/* ── Top bar ── */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-100 bg-white z-10 flex-shrink-0">
        <Link
          href="/products-list"
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#0D0D14] transition-colors whitespace-nowrap"
        >
          <span className="text-base leading-none">‹</span> Back to Home
        </Link>
        <div className="flex-1 min-w-0">
          <input
            value={rfqTitle}
            onChange={(e) => setRfqTitle(e.target.value)}
            className="w-full text-sm font-semibold text-[#0D0D14] bg-transparent outline-none border-b border-primary pb-0.5 truncate placeholder:text-gray-300"
            placeholder="Product RFQ title…"
          />
        </div>
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:text-[#0D0D14] hover:bg-gray-50 transition-colors"
          title={panelOpen ? 'Hide RFQ panel' : 'Show RFQ panel'}
        >
          {panelOpen ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Chat ── */}
        <div className={`flex flex-col transition-all duration-300 ${panelOpen ? 'w-[56%]' : 'w-full'}`}>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-8 pt-8 pb-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  onOptionClick={handleSend}
                  isLoading={isDisabled}
                />
              ))}
              {isDisabled && messages[messages.length - 1]?.role === 'user' && (
                <TypingIndicator />
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* ── Input area ── */}
          <div className="flex-shrink-0 border-t border-gray-100 bg-white">
            <div className="max-w-2xl mx-auto px-8 py-4">
              <div className="border border-gray-200 rounded-2xl bg-white focus-within:border-gray-400 transition-colors duration-150 overflow-hidden">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(inputValue);
                    }
                  }}
                  placeholder="Describe what you want to build"
                  rows={2}
                  disabled={isDisabled}
                  className="w-full px-4 pt-3.5 pb-1 text-sm text-[#0D0D14] placeholder:text-gray-300 outline-none resize-none bg-transparent disabled:opacity-50 leading-relaxed"
                />
                <div className="flex items-center justify-between px-4 pb-3 pt-1">
                  <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0D0D14] transition-colors">
                    <Paperclip size={12} /> Add references
                  </button>
                  <button
                    onClick={() => handleSend(inputValue)}
                    disabled={!inputValue.trim() || isDisabled}
                    className="w-7 h-7 rounded-full bg-[#0D0D14] text-white flex items-center justify-center transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed hover:bg-[#1a1a26] active:scale-95 flex-shrink-0"
                  >
                    {isDisabled
                      ? <Loader2 size={13} className="animate-spin" />
                      : <ArrowUp size={13} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: RFQ panel ── */}
        {panelOpen && (
          <div className="flex-1 overflow-hidden border-l border-gray-100 flex flex-col">
            <RFQPanel
              rfq={rfq}
              rfqTitle={rfqTitle}
              finalized={finalized}
              isLoading={isDisabled}
              onFinalize={handleFinalize}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function deriveProductName(text: string): string {
  const words = text.split(' ').slice(0, 8).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ─── Main orchestrator ────────────────────────────────────────────────────────
export default function NewProductFlow() {
  const [step, setStep] = useState<Step>('intro');
  const [productText, setProductText] = useState('');

  const productName = deriveProductName(productText);

  if (step === 'intro') {
    return <IntroStep onNext={(text) => { setProductText(text); setStep('transition'); }} />;
  }
  if (step === 'transition') {
    return <TransitionStep productText={productText} onNext={() => setStep('choose')} />;
  }
  if (step === 'choose') {
    return <ChooseStep onNext={() => setStep('builder')} />;
  }
  return <BuilderStep productText={productText} productName={productName} />;
}
