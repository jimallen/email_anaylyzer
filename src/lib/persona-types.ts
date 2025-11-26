import { z } from 'zod';

/**
 * Persona email configuration for visual customization
 * Supports basic color scheme and header text customization
 */
export const PersonaEmailConfigSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Primary color must be a valid hex color (e.g., #E91E63)'),
  headerText: z.string().min(1).max(100, 'Header text must be between 1 and 100 characters'),
});

export type PersonaEmailConfig = z.infer<typeof PersonaEmailConfigSchema>;

/**
 * Persona definition schema
 * Represents an AI persona with unique expertise, tone, and analysis approach
 */
export const PersonaSchema = z.object({
  personaId: z.string().min(1).max(50, 'Persona ID must be between 1 and 50 characters'),
  emailAddress: z.string().email('Must be a valid email address'),
  name: z.string().min(1).max(100, 'Name must be between 1 and 100 characters'),
  description: z.string().min(10).max(500, 'Description must be between 10 and 500 characters'),
  systemPrompt: z.string().min(100).max(5000, 'System prompt must be between 100 and 5000 characters'),
  focusAreas: z.array(z.string()).min(1).max(10, 'Must have between 1 and 10 focus areas'),
  tone: z.string().min(5).max(200, 'Tone description must be between 5 and 200 characters'),
  customSections: z.array(z.string()).max(5, 'Cannot have more than 5 custom sections').optional(),
  emailConfig: PersonaEmailConfigSchema,
  isActive: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type Persona = z.infer<typeof PersonaSchema>;

/**
 * Partial persona for updates (all fields optional except personaId)
 */
export const PartialPersonaSchema = PersonaSchema.partial().required({ personaId: true });

export type PartialPersona = z.infer<typeof PartialPersonaSchema>;

/**
 * Default persona ID constant
 * Used as fallback when no persona is found for an email address
 */
export const DEFAULT_PERSONA_ID = 'jenny-bot';

/**
 * Cache entry for persona with TTL
 */
export interface PersonaCacheEntry {
  persona: Persona;
  expiresAt: number;
}

/**
 * Persona cache type for in-memory storage
 */
export type PersonaCache = Map<string, PersonaCacheEntry>;
