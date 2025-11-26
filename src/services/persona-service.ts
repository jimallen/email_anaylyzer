import type { FastifyBaseLogger } from 'fastify';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { Persona, PersonaCacheEntry, PersonaCache } from '../lib/persona-types';
import { DEFAULT_PERSONA_ID } from '../lib/persona-types';

/**
 * Persona service for managing AI persona configurations
 * Provides persona lookup with in-memory caching
 */

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const PERSONA_TABLE_NAME = process.env.PERSONA_TABLE_NAME || 'EmailAnalysisPersonas';
const CACHE_TTL_MS = 3600000; // 1 hour

// In-memory cache for personas
const personaCache: PersonaCache = new Map<string, PersonaCacheEntry>();

/**
 * Clears expired entries from the persona cache
 * Called periodically to prevent memory leaks
 */
function cleanExpiredCacheEntries(): void {
  const now = Date.now();
  for (const [key, entry] of personaCache.entries()) {
    if (entry.expiresAt < now) {
      personaCache.delete(key);
    }
  }
}

// Set up periodic cache cleanup every hour
setInterval(cleanExpiredCacheEntries, CACHE_TTL_MS);

/**
 * Gets a persona from cache if available and not expired
 *
 * @param cacheKey - Cache key (typically email address or personaId)
 * @returns Persona if found and valid, null otherwise
 */
function getFromCache(cacheKey: string): Persona | null {
  const entry = personaCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    personaCache.delete(cacheKey);
    return null;
  }

  return entry.persona;
}

/**
 * Stores a persona in cache with TTL
 *
 * @param cacheKey - Cache key (typically email address or personaId)
 * @param persona - Persona to cache
 */
function storeInCache(cacheKey: string, persona: Persona): void {
  personaCache.set(cacheKey, {
    persona,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Gets a persona by email address using the EmailAddressIndex GSI
 *
 * @param emailAddress - Email address to look up
 * @param logger - Optional Fastify logger
 * @returns Persona if found, null otherwise
 */
export async function getPersonaByEmail(
  emailAddress: string,
  logger?: FastifyBaseLogger
): Promise<Persona | null> {
  try {
    // Check cache first
    const cached = getFromCache(emailAddress);
    if (cached) {
      logger?.debug({
        emailAddress,
        personaId: cached.personaId,
        cacheHit: true,
      }, 'Persona retrieved from cache');
      return cached;
    }

    logger?.debug({
      emailAddress,
      tableName: PERSONA_TABLE_NAME,
      indexName: 'EmailAddressIndex',
    }, 'Querying persona by email address');

    const command = new QueryCommand({
      TableName: PERSONA_TABLE_NAME,
      IndexName: 'EmailAddressIndex',
      KeyConditionExpression: 'emailAddress = :emailAddress',
      ExpressionAttributeValues: {
        ':emailAddress': emailAddress,
      },
      Limit: 1, // We only need one persona per email
    });

    const response = await docClient.send(command);

    if (!response.Items || response.Items.length === 0) {
      logger?.debug({
        emailAddress,
      }, 'No persona found for email address');
      return null;
    }

    const persona = response.Items[0] as Persona;

    // Check if persona is active
    if (!persona.isActive) {
      logger?.warn({
        emailAddress,
        personaId: persona.personaId,
      }, 'Found persona but it is inactive');
      return null;
    }

    // Store in cache for future lookups
    storeInCache(emailAddress, persona);
    storeInCache(persona.personaId, persona); // Also cache by personaId for getDefaultPersona

    logger?.info({
      emailAddress,
      personaId: persona.personaId,
      personaName: persona.name,
      cacheHit: false,
    }, 'Persona retrieved from DynamoDB');

    return persona;
  } catch (error) {
    logger?.error({
      emailAddress,
      error: error instanceof Error ? error.message : String(error),
      tableName: PERSONA_TABLE_NAME,
    }, 'Failed to get persona by email address');

    return null;
  }
}

/**
 * Gets a persona by personaId (direct lookup by partition key)
 *
 * @param personaId - Persona ID to look up
 * @param logger - Optional Fastify logger
 * @returns Persona if found, null otherwise
 */
export async function getPersonaById(
  personaId: string,
  logger?: FastifyBaseLogger
): Promise<Persona | null> {
  try {
    // Check cache first
    const cached = getFromCache(personaId);
    if (cached) {
      logger?.debug({
        personaId,
        cacheHit: true,
      }, 'Persona retrieved from cache by ID');
      return cached;
    }

    logger?.debug({
      personaId,
      tableName: PERSONA_TABLE_NAME,
    }, 'Getting persona by ID');

    const command = new GetCommand({
      TableName: PERSONA_TABLE_NAME,
      Key: {
        personaId,
      },
    });

    const response = await docClient.send(command);

    if (!response.Item) {
      logger?.warn({
        personaId,
      }, 'Persona not found by ID');
      return null;
    }

    const persona = response.Item as Persona;

    // Check if persona is active
    if (!persona.isActive) {
      logger?.warn({
        personaId,
      }, 'Found persona but it is inactive');
      return null;
    }

    // Store in cache for future lookups
    storeInCache(personaId, persona);
    if (persona.emailAddress) {
      storeInCache(persona.emailAddress, persona); // Also cache by email address
    }

    logger?.info({
      personaId,
      personaName: persona.name,
      cacheHit: false,
    }, 'Persona retrieved from DynamoDB by ID');

    return persona;
  } catch (error) {
    logger?.error({
      personaId,
      error: error instanceof Error ? error.message : String(error),
      tableName: PERSONA_TABLE_NAME,
    }, 'Failed to get persona by ID');

    return null;
  }
}

/**
 * Gets the default persona (Jenny-bot)
 * Used as fallback when no persona is found for an email address
 *
 * @param logger - Optional Fastify logger
 * @returns Default persona, or null if default persona is not configured
 */
export async function getDefaultPersona(
  logger?: FastifyBaseLogger
): Promise<Persona | null> {
  logger?.debug({
    defaultPersonaId: DEFAULT_PERSONA_ID,
  }, 'Getting default persona');

  const persona = await getPersonaById(DEFAULT_PERSONA_ID, logger);

  if (!persona) {
    logger?.error({
      defaultPersonaId: DEFAULT_PERSONA_ID,
    }, 'Default persona not found - this is a configuration error');
  }

  return persona;
}

/**
 * Creates a new persona in DynamoDB
 * Used by seed scripts and admin operations
 *
 * @param persona - Persona to create
 * @param logger - Optional Fastify logger
 * @returns Success boolean
 */
export async function createPersona(
  persona: Persona,
  logger?: FastifyBaseLogger
): Promise<boolean> {
  try {
    logger?.info({
      personaId: persona.personaId,
      emailAddress: persona.emailAddress,
      name: persona.name,
      tableName: PERSONA_TABLE_NAME,
    }, 'Creating persona');

    const command = new PutCommand({
      TableName: PERSONA_TABLE_NAME,
      Item: persona,
      ConditionExpression: 'attribute_not_exists(personaId)', // Prevent overwriting existing persona
    });

    await docClient.send(command);

    // Clear cache entries to ensure fresh data on next lookup
    personaCache.delete(persona.personaId);
    personaCache.delete(persona.emailAddress);

    logger?.info({
      personaId: persona.personaId,
      personaName: persona.name,
    }, 'Successfully created persona');

    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      logger?.warn({
        personaId: persona.personaId,
      }, 'Persona already exists');
      return false;
    }

    logger?.error({
      personaId: persona.personaId,
      error: error instanceof Error ? error.message : String(error),
      tableName: PERSONA_TABLE_NAME,
    }, 'Failed to create persona');

    return false;
  }
}

/**
 * Updates an existing persona in DynamoDB
 * Used by seed scripts (idempotent mode) and admin operations
 *
 * @param persona - Persona to update (must include personaId)
 * @param logger - Optional Fastify logger
 * @returns Success boolean
 */
export async function updatePersona(
  persona: Persona,
  logger?: FastifyBaseLogger
): Promise<boolean> {
  try {
    logger?.info({
      personaId: persona.personaId,
      emailAddress: persona.emailAddress,
      name: persona.name,
      tableName: PERSONA_TABLE_NAME,
    }, 'Updating persona');

    const command = new PutCommand({
      TableName: PERSONA_TABLE_NAME,
      Item: persona,
    });

    await docClient.send(command);

    // Clear cache entries to ensure fresh data on next lookup
    personaCache.delete(persona.personaId);
    personaCache.delete(persona.emailAddress);

    logger?.info({
      personaId: persona.personaId,
      personaName: persona.name,
    }, 'Successfully updated persona');

    return true;
  } catch (error) {
    logger?.error({
      personaId: persona.personaId,
      error: error instanceof Error ? error.message : String(error),
      tableName: PERSONA_TABLE_NAME,
    }, 'Failed to update persona');

    return false;
  }
}

/**
 * Creates or updates a persona (idempotent operation)
 * Attempts to create first; if persona exists, updates instead
 *
 * @param persona - Persona to create or update
 * @param logger - Optional Fastify logger
 * @returns Success boolean
 */
export async function upsertPersona(
  persona: Persona,
  logger?: FastifyBaseLogger
): Promise<boolean> {
  const created = await createPersona(persona, logger);
  if (created) {
    return true;
  }

  // If create failed due to existing persona, try update
  logger?.debug({
    personaId: persona.personaId,
  }, 'Persona exists, attempting update');

  return await updatePersona(persona, logger);
}
