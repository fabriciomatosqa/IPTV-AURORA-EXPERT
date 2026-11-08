import { Injectable } from '@angular/core';

export interface ActorWork {
    title: string;
    year?: string;
    wikidataId?: string;
}
export interface ActorProfile {
    name: string;
    wikidataId?: string;
    photoUrl?: string;
}

/**
 * Public Wikidata / Wikimedia Commons metadata only; requires no API key.
 * Pictures and filmographies may be absent for some actors. Never fabricate
 * photos or silently associate ambiguous names with an unrelated person.
 */
@Injectable({ providedIn: 'root' })
export class ActorFilmographyService {
    private readonly profiles = new Map<string, Promise<ActorProfile>>();
    private readonly works = new Map<string, Promise<ActorWork[]>>();

    profile(name: string): Promise<ActorProfile> {
        const key = name.trim().toLocaleLowerCase();
        if (!this.profiles.has(key)) {
            this.profiles.set(key, this.loadProfile(name.trim()));
        }
        return this.profiles.get(key)!;
    }

    filmography(actorId?: string): Promise<ActorWork[]> {
        if (!actorId || !/^Q\d{1,12}$/.test(actorId)) {
            return Promise.resolve([]);
        }
        if (!this.works.has(actorId)) {
            this.works.set(actorId, this.loadWorks(actorId));
        }
        return this.works.get(actorId)!;
    }

    private async requestJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
            });
            return response.ok ? (await response.json()) as T : null;
        } catch {
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }

    private async loadProfile(name: string): Promise<ActorProfile> {
        const fallback: ActorProfile = { name };
        if (!name) return fallback;
        const base = 'https://www.wikidata.org/w/api.php';
        const searchParams = new URLSearchParams({
            action: 'wbsearchentities',
            search: name,
            language: 'en',
            uselang: 'pt',
            limit: '7',
            format: 'json',
            origin: '*',
        });
        const search = await this.requestJson<{
            search?: Array<{ id: string; label?: string; description?: string }>;
        }>(`${base}?${searchParams}`);
        const candidates = search?.search ?? [];
        const normalized = name.toLocaleLowerCase();
        const matched = candidates.find((entry) =>
            entry.label?.trim().toLocaleLowerCase() === normalized &&
            /\b(actor|actress|ator|atriz|performer)\b/i.test(entry.description ?? '')
        );
        if (!matched || !/^Q\d+$/.test(matched.id)) return fallback;

        const entityParams = new URLSearchParams({
            action: 'wbgetentities', ids: matched.id,
            props: 'claims', format: 'json', origin: '*',
        });
        const response = await this.requestJson<{
            entities?: Record<string, {
                claims?: { P18?: Array<{
                    mainsnak?: { datavalue?: { value?: string } };
                }> };
            }>;
        }>(`${base}?${entityParams}`);
        const image = response?.entities?.[matched.id]?.claims?.P18?.[0]
            ?.mainsnak?.datavalue?.value;
        // FilePath redirects to the CDN thumbnail; no API key or scraping.
        const photoUrl = image
            ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(image)}?width=220`
            : undefined;
        return { name, wikidataId: matched.id, photoUrl };
    }

    private async loadWorks(actorId: string): Promise<ActorWork[]> {
        const query = `SELECT DISTINCT ?work ?workLabel ?date WHERE {
          ?work wdt:P161 wd:${actorId}.
          OPTIONAL { ?work wdt:P577 ?date. }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en". }
        } LIMIT 80`;
        const params = new URLSearchParams({ query, format: 'json' });
        const data = await this.requestJson<{
            results?: { bindings?: Array<{
                work?: { value?: string };
                workLabel?: { value?: string };
                date?: { value?: string };
            }> };
        }>(`https://query.wikidata.org/sparql?${params}`, 12000);
        const deduped = new Map<string, ActorWork>();
        for (const entry of data?.results?.bindings ?? []) {
            const title = entry.workLabel?.value?.trim() ?? '';
            if (!title || /^Q\d+$/.test(title) || title.length > 180) continue;
            const id = entry.work?.value?.match(/Q\d+$/)?.[0];
            if (!id || deduped.has(id)) continue;
            deduped.set(id, {
                title,
                year: entry.date?.value?.slice(0, 4),
                wikidataId: id,
            });
        }
        return [...deduped.values()].sort((a, b) =>
            (b.year ?? '').localeCompare(a.year ?? '') ||
            a.title.localeCompare(b.title)
        );
    }
}
