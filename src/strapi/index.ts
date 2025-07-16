import { z, ZodObject, ZodTypeAny } from "zod";

export type StrapiQueryOptions = {
  contentType: string;
  filter?: string;
  populate?: string;
  sort?: string;
  paginate?: { limit: number };
};

export type StrapiConfig = {
  store_slug: string;
  api_url: string;
  sync_interval: number;
};

/**
 * Creates a Strapi content loader for Astro
 * @param contentType The Strapi content type to load
 * @param filter The filter to apply to the content &filters[store][id][$eq]=${STRAPI_STORE_ID}
 * @returns An Astro loader for the specified content type
 */
export async function fetchStrapiContent(
  query: StrapiQueryOptions,
  config: StrapiConfig
): Promise<any[]> {
  const { contentType, filter, populate = 'SEO.socialImage', paginate, sort = "updatedAt:desc" } = query;
  const { api_url } = config;

  let filterKey = '', filterValue = '';
  if (filter) [filterKey, filterValue] = filter.split('=');

  const data = await fetchFromStrapi(`/api/${contentType}s?`, {
    [filterKey]: filterValue,
    populate,
    'pagination[limit]': (paginate?.limit || '') as string || '25',
    sort,
  }, api_url);

  const posts = data?.data;
  if (!Array.isArray(posts)) throw new Error("Invalid data received from Strapi");

  return posts;
}

export async function fetchStrapiSchema(contentType: string, api_url: string): Promise<ZodObject<any>> {
  const data = await fetchFromStrapi(`/get-strapi-schema/schema/${contentType}`, {}, api_url);
  if (!data?.attributes) throw new Error("Invalid schema data received from Strapi");

  return generateZodSchema(data.attributes);
}

function mapTypeToZodSchema(type: string, field: any): ZodTypeAny {
  const schemaMap: Record<string, () => ZodTypeAny> = {
    string: () => z.string(),
    uid: () => z.string(),
    documentId: () => z.string(),
    richtext: () => z.string(),
    datetime: () => z.string().datetime(),
    boolean: () => z.boolean(),
    number: () => z.number(),
    array: () => z.array(mapTypeToZodSchema(field.items.type, field.items)),
    object: () => {
      const shape: Record<string, ZodTypeAny> = {};
      for (const [key, value] of Object.entries(field.properties)) {
        if (typeof value === "object" && value !== null && "type" in value) {
          shape[key] = mapTypeToZodSchema(value?.type as string, value);
        } else {
          throw new Error(`Invalid field value for key: ${key}`);
        }
      }
      return z.object(shape);
    },
    text: () => z.string(),
    media: () =>
      z.object({
        url: z.string(),
        alternativeText: z.string().optional(),
        caption: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      }),
    relation: () => z.any(), // Simplified or customize based on use case
    dynamiczone: () => z.array(z.object({ __component: z.string() })),
  };

  return (schemaMap[type] || (() => z.any()))();
}

function generateZodSchema(attributes: Record<string, any>): ZodObject<any> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const [key, value] of Object.entries(attributes)) {
    const { type, ...rest } = value;
    shape[key] = mapTypeToZodSchema(type, rest);
  }

  return z.object(shape);
}

async function fetchFromStrapi(
  path: string,
  params: Record<string, string> = {},
  baseUrl: string
): Promise<any> {
  const url = new URL(path, baseUrl);

  if (params.populate) {
    const populateFields = params.populate.split(',');

    populateFields.forEach((field, index) => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        url.searchParams.append('populate', parent);
        url.searchParams.append(`populate[${index + 1}]`, `${parent}.${child}`);
      } else {
        url.searchParams.append('populate', field);
      }
    });

    delete params.populate;
  }

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.href);

  if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
  return response.json();
}

