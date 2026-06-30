// Shared AI-personality presets used by BOTH the concierge API (to build the
// system prompt) and the dashboard (to render the customization UI). Keeping the
// ids/labels in one place means the picker and the prompt can never drift apart.

export type PersonaId =
  | "warm_host"
  | "refined_maitre"
  | "playful_foodie"
  | "efficient_pro"
  | "luxury_concierge";

export type AnswerLengthId = "concise" | "balanced" | "detailed" | "adaptive";

export type Persona = {
  id: PersonaId;
  label: string;
  tagline: string;
  /** Injected into the system prompt to shape the concierge's voice. */
  voice: string;
};

export const PERSONAS: Persona[] = [
  {
    id: "warm_host",
    label: "Warm Host",
    tagline: "Friendly & welcoming",
    voice:
      "a warm, genuine host at a beloved neighborhood spot. Greet guests kindly, " +
      "sound personable and happy to help, and make every guest feel looked after.",
  },
  {
    id: "refined_maitre",
    label: "Refined Maître",
    tagline: "Polished fine-dining",
    voice:
      "a polished fine-dining maître d'. Speak with composed, articulate, quietly " +
      "confident hospitality — gracious and elegant, never stuffy.",
  },
  {
    id: "playful_foodie",
    label: "Playful Foodie",
    tagline: "Upbeat & fun",
    voice:
      "an upbeat, witty foodie who genuinely loves the menu. Be enthusiastic and " +
      "conversational, with the occasional tasteful emoji — fun but still helpful.",
  },
  {
    id: "efficient_pro",
    label: "Efficient Pro",
    tagline: "Clear & to the point",
    voice:
      "a sharp, efficient professional. Get the guest a clear, direct answer fast " +
      "with no fluff, while staying courteous and friendly.",
  },
  {
    id: "luxury_concierge",
    label: "Luxury Concierge",
    tagline: "Elegant & white-glove",
    voice:
      "an elegant, white-glove concierge. Anticipate the guest's needs and respond " +
      "with effortless grace, attentiveness, and a touch of quiet luxury.",
  },
];

export type AnswerLength = {
  id: AnswerLengthId;
  label: string;
  desc: string;
  /** Cap on response tokens — shorter answers cost less. */
  maxTokens: number;
  /** Length guidance injected into the prompt. */
  instruction: string;
};

export const ANSWER_LENGTHS: AnswerLength[] = [
  {
    id: "concise",
    label: "Concise",
    desc: "1–2 short sentences",
    maxTokens: 200,
    instruction:
      "Keep replies to one or two short sentences — answer the question directly, no filler.",
  },
  {
    id: "balanced",
    label: "Balanced",
    desc: "2–3 natural sentences",
    maxTokens: 340,
    instruction:
      "Write 2–3 natural sentences — warm and helpful without rambling.",
  },
  {
    id: "detailed",
    label: "Detailed",
    desc: "Fuller, richer replies",
    maxTokens: 640,
    instruction:
      "Give a fuller, richer reply (up to 4–5 sentences) when it helps, painting an inviting picture.",
  },
  {
    id: "adaptive",
    label: "Adaptive",
    desc: "Matches the question",
    maxTokens: 520,
    instruction:
      "Match your length to the question — a quick line for simple asks, a fuller reply when the guest clearly wants detail.",
  },
];

const DEFAULT_PERSONA = PERSONAS[0];
const DEFAULT_LENGTH = ANSWER_LENGTHS[1]; // balanced

export function personaById(id?: string | null): Persona {
  return PERSONAS.find((p) => p.id === id) ?? DEFAULT_PERSONA;
}

export function answerLengthById(id?: string | null): AnswerLength {
  return ANSWER_LENGTHS.find((l) => l.id === id) ?? DEFAULT_LENGTH;
}
