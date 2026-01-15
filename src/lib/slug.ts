import slugify from 'slugify';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

const RESERVED_SLUGS = new Set(['new', 'edit', 'api', 'settings']);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_LENGTH = 50;

export const slugSchema = z
  .string()
  .min(MIN_SLUG_LENGTH)
  .max(MAX_SLUG_LENGTH)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((slug) => !RESERVED_SLUGS.has(slug), { message: 'This slug is reserved' })
  .refine((slug) => !UUID_REGEX.test(slug), { message: 'Slug cannot look like a UUID' });

export function generateSlug(name: string): string {
  let slug = slugify(name, { lower: true, strict: true });

  if (slug.length < MIN_SLUG_LENGTH) {
    const suffix = Math.random().toString(36).substring(2, 6);
    slug = slug ? `${slug}-${suffix}` : suffix;
  }

  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.substring(0, MAX_SLUG_LENGTH).replace(/-+$/, '');
  }

  // If slug is reserved, append a suffix to make it valid
  if (RESERVED_SLUGS.has(slug)) {
    const suffix = Math.random().toString(36).substring(2, 6);
    slug = `${slug}-${suffix}`;
  }

  return slug;
}

export function validateSlug(slug: string): { valid: boolean; error?: string } {
  const result = slugSchema.safeParse(slug);
  if (!result.success) {
    return { valid: false, error: result.error.issues[0].message };
  }
  return { valid: true };
}

export function isUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

export async function generateUniqueSlug(
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  if (!(await checkExists(baseSlug))) {
    return baseSlug;
  }

  let suffix = 1;
  while (suffix < 1000) {
    const candidateSlug = `${baseSlug}-${suffix}`;
    if (candidateSlug.length > MAX_SLUG_LENGTH) {
      const truncatedBase = baseSlug.substring(0, MAX_SLUG_LENGTH - suffix.toString().length - 1);
      const truncatedCandidate = `${truncatedBase}-${suffix}`;
      if (!(await checkExists(truncatedCandidate))) {
        return truncatedCandidate;
      }
    } else if (!(await checkExists(candidateSlug))) {
      return candidateSlug;
    }
    suffix++;
  }

  throw new Error('Unable to generate unique slug');
}

export async function resolveFlowByIdentifier(
  supabase: SupabaseClient,
  identifier: string
): Promise<{ id: string; slug: string | null } | null> {
  const isId = isUUID(identifier);
  const column = isId ? 'id' : 'slug';
  const normalizedIdentifier = isId ? identifier : identifier.toLowerCase();

  const { data, error } = await supabase
    .from('flows')
    .select('id, slug')
    .eq(column, normalizedIdentifier)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
