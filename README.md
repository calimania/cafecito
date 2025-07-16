# Cafecito

React component library, in typescript. Augmenting other librariies.

Easy to consume in astro & other applications.

For the markkët content management system and compatible structures.

# Utilities

- Strapi loader for astro

# React components

## Dependencies

- Astro content

# Install

```
npm install cafecito
```

## Usage


### Astro Content Layer

introduced [v.0.10.0]

Create a `strapi-loader` file to use in your `content/config`


```typescript
// - src/lib/strapi-loader
import type { Loader } from "astro/loaders";
import { markketplace } from "@/config";

import {
  fetchStrapiContent,
  fetchStrapiSchema,
  StrapiConfig,
  StrapiQueryOptions,
} from 'cafecito/strapi';

const config: StrapiConfig = {
  store_slug: markketplace.STORE_SLUG,
  api_url: markketplace.STRAPI_URL,
  sync_interval: 60000,
};

const query: StrapiQueryOptions = {
  contentType: 'article',
  filter: `filters[store][id][$eq]=${markketplace.STORE_SLUG}`,
  populate: 'SEO.socialImage',
};

/**
 * Creates a Strapi content loader for Astro
 * @param contentType The Strapi content type to load
 * @param filter The filter to apply to the content &filters[store][id][$eq]=${STRAPI_STORE_ID}
 * @returns An Astro loader for the specified content type
 */
export function strapiLoader({ contentType, filter, populate = 'SEO.socialImage', paginate }: { contentType: string, filter?: string, populate?: string, paginate?: { limit: number } }): Loader {
  return {
    name: `strapi-${contentType}`,
    schema: async () => await fetchStrapiSchema(query.contentType, config.api_url),
    async load({ store, logger, meta }) {
      const lastSynced = meta.get("lastSynced");
      console.log('a')
      if (lastSynced && Date.now() - Number(lastSynced) < config.sync_interval) {
        logger.info("Skipping sync");
        return;
      }

      const posts = await fetchStrapiContent(query, config);

      store.clear();
      posts.forEach((item: any) => store.set({ id: item.id, data: item }));
      meta.set("lastSynced", String(Date.now()));
    },
  };
}


// content/config.ts

import { strapiLoader } from "../lib/strapi-loader";

const pages = defineCollection({
  loader: strapiLoader({
    contentType: "page",
    filter: `filters[store][slug][$eq]=${markketplace.STORE_SLUG}`,
    populate: 'SEO.socialImage'
  }),
});

export const collections = { pages };

// pages/index.astro
const pages = await getCollection("pages");


// src/pages/[slug].astro

import { type CollectionEntry, } from "astro:content";
type Page = CollectionEntry<"pages">;

```


# Contributing


# License

[TSL](./LICENSE)
