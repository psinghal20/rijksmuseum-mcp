import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  AAT,
  RKM_DIMENSION_TYPES,
  LinkedArtSearchResponse,
  LinkedArtHumanMadeObject,
  LinkedArtVisualItem,
  LinkedArtDigitalObject,
  LinkedArtClassification,
  LinkedArtLinguisticObject,
  LinkedArtName,
  LinkedArtIdentifier,
  SearchArtworkArguments,
  ArtworkSearchResult,
  ArtworkSearchResponse,
  ArtworkDetails,
  TimelineArtwork,
} from '../types.js';

const CONCURRENCY_LIMIT = 10;

export class RijksmuseumApiClient {
  private axiosInstance: AxiosInstance;
  private readonly BASE_URL = 'https://data.rijksmuseum.nl';

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000,
      headers: {
        'Accept': 'application/ld+json',
      },
    });

    this.axiosInstance.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        if (error.response) {
          throw new Error(`Rijksmuseum API error: ${error.response.status} - ${error.response.statusText}`);
        } else if (error.request) {
          throw new Error('No response received from Rijksmuseum API');
        } else {
          throw new Error(`Error making request to Rijksmuseum API: ${error.message}`);
        }
      }
    );
  }

  // --- Private helpers ---

  private async resolveEntity<T>(url: string): Promise<T> {
    // Normalize id.rijksmuseum.nl to data.rijksmuseum.nl to skip 303 redirect
    const normalizedUrl = url.replace('https://id.rijksmuseum.nl/', 'https://data.rijksmuseum.nl/');
    const response = await this.axiosInstance.get<T>(normalizedUrl);
    return response.data;
  }

  private async resolveImageUrl(obj: LinkedArtHumanMadeObject): Promise<string | null> {
    try {
      // Hop 1: Get the VisualItem reference from shows[]
      const visualItemRef = obj.shows?.[0];
      if (!visualItemRef?.id) return null;

      // Hop 2: Resolve the VisualItem to get digitally_shown_by
      const visualItem = await this.resolveEntity<LinkedArtVisualItem>(visualItemRef.id);
      const digitalObjectRef = visualItem.digitally_shown_by?.[0];
      if (!digitalObjectRef?.id) return null;

      // Hop 3: Resolve the DigitalObject to get access_point (IIIF URL)
      const digitalObject = await this.resolveEntity<LinkedArtDigitalObject>(digitalObjectRef.id);
      const accessPoint = digitalObject.access_point?.[0];
      return accessPoint?.id ?? null;
    } catch {
      return null;
    }
  }

  // --- Static extraction helpers (for parsing Linked Art JSON-LD) ---

  private static hasClassification(classifiedAs: Array<LinkedArtClassification | string> | undefined, aatUri: string): boolean {
    return classifiedAs?.some(c => (typeof c === 'string' ? c : c.id) === aatUri) ?? false;
  }

  private static languageMatches(langRefs: { id: string }[] | undefined, lang: string): boolean {
    const langUri = lang === 'nl' ? AAT.LANG_NL : AAT.LANG_EN;
    return langRefs?.some(l => l.id === langUri) ?? false;
  }

  static extractObjectNumber(obj: LinkedArtHumanMadeObject): string | null {
    const entries = obj.identified_by ?? [];
    for (const entry of entries) {
      if (entry.type === 'Identifier' && RijksmuseumApiClient.hasClassification((entry as LinkedArtIdentifier).classified_as, AAT.OBJECT_NUMBER)) {
        return (entry as LinkedArtIdentifier).content;
      }
    }
    return null;
  }

  static extractTitle(obj: LinkedArtHumanMadeObject, lang: string = 'en'): string | null {
    const entries = obj.identified_by ?? [];
    const names = entries.filter((e): e is LinkedArtName => e.type === 'Name');

    // Priority 1: Primary title (aat/300417200) in preferred language
    for (const name of names) {
      if (RijksmuseumApiClient.hasClassification(name.classified_as, AAT.TITLE) &&
          RijksmuseumApiClient.languageMatches(name.language, lang)) {
        return name.content;
      }
    }

    // Priority 2: Display title (aat/300417207) in preferred language
    for (const name of names) {
      if (RijksmuseumApiClient.hasClassification(name.classified_as, AAT.DISPLAY_TITLE) &&
          RijksmuseumApiClient.languageMatches(name.language, lang)) {
        return name.content;
      }
    }

    // Priority 3: Any title in preferred language
    for (const name of names) {
      if (RijksmuseumApiClient.languageMatches(name.language, lang)) {
        return name.content;
      }
    }

    // Priority 4: Any primary title
    for (const name of names) {
      if (RijksmuseumApiClient.hasClassification(name.classified_as, AAT.TITLE)) {
        return name.content;
      }
    }

    // Priority 5: Any name at all
    return names[0]?.content ?? null;
  }

  static extractAllTitles(obj: LinkedArtHumanMadeObject): Array<{ title: string; language: string | null; type: string | null }> {
    const entries = obj.identified_by ?? [];
    const names = entries.filter((e): e is LinkedArtName => e.type === 'Name');

    return names.map(name => {
      let language: string | null = null;
      if (RijksmuseumApiClient.languageMatches(name.language, 'en')) language = 'en';
      else if (RijksmuseumApiClient.languageMatches(name.language, 'nl')) language = 'nl';

      let type: string | null = null;
      if (RijksmuseumApiClient.hasClassification(name.classified_as, AAT.TITLE)) type = 'title';
      else if (RijksmuseumApiClient.hasClassification(name.classified_as, AAT.DISPLAY_TITLE)) type = 'display_title';

      return { title: name.content, language, type };
    });
  }

  static extractArtist(obj: LinkedArtHumanMadeObject, lang: string = 'en'): string | null {
    const refs = obj.produced_by?.referred_to_by ?? [];
    for (const ref of refs) {
      if (ref.type === 'LinguisticObject' &&
          (RijksmuseumApiClient.hasClassification(ref.classified_as, AAT.CREATOR_DESCRIPTION) ||
           RijksmuseumApiClient.hasClassification(ref.classified_as, AAT.CREATOR_LABEL))) {
        if (ref.content && RijksmuseumApiClient.languageMatches(ref.language, lang)) {
          return ref.content;
        }
      }
    }
    // Fallback: any creator description regardless of language
    for (const ref of refs) {
      if (ref.type === 'LinguisticObject' &&
          (RijksmuseumApiClient.hasClassification(ref.classified_as, AAT.CREATOR_DESCRIPTION) ||
           RijksmuseumApiClient.hasClassification(ref.classified_as, AAT.CREATOR_LABEL))) {
        if (ref.content) return ref.content;
      }
    }
    return null;
  }

  static extractDates(obj: LinkedArtHumanMadeObject, lang: string = 'en'): { display: string | null; begin: string | null; end: string | null } {
    const timespan = obj.produced_by?.timespan;
    if (!timespan) return { display: null, begin: null, end: null };

    // Extract display date from identified_by names on the timespan
    let display: string | null = timespan._label ?? null;
    if (!display && timespan.identified_by) {
      const names = timespan.identified_by.filter((e): e is LinkedArtName => e.type === 'Name');
      // Try preferred language first
      for (const name of names) {
        if (RijksmuseumApiClient.languageMatches(name.language, lang)) {
          display = name.content;
          break;
        }
      }
      // Fallback to any name
      if (!display && names.length > 0) {
        display = names[0].content;
      }
    }

    return {
      display,
      begin: timespan.begin_of_the_begin ?? null,
      end: timespan.end_of_the_end ?? null,
    };
  }

  static extractDescription(obj: LinkedArtHumanMadeObject, lang: string = 'en'): string | null {
    const langUri = lang === 'nl' ? AAT.LANG_NL : AAT.LANG_EN;

    // Collect all description candidates from subject_of parts
    const candidates: Array<{ content: string; hasLang: boolean; langMatch: boolean; index: number }> = [];
    const subjectOf = obj.subject_of ?? [];

    for (let i = 0; i < subjectOf.length; i++) {
      const entry = subjectOf[i];
      if (!('type' in entry) || entry.type !== 'LinguisticObject') continue;
      const lingObj = entry as LinkedArtLinguisticObject;
      if (!lingObj.part) continue;

      for (const part of lingObj.part) {
        if (!RijksmuseumApiClient.hasClassification(part.classified_as as LinkedArtClassification[], AAT.DESCRIPTION)) continue;
        if (!part.content) continue;

        const hasLang = (part.language?.length ?? 0) > 0;
        const langMatch = hasLang && part.language!.some(l => l.id === langUri);
        candidates.push({ content: part.content, hasLang, langMatch, index: i });
      }
    }

    // Priority 1: description with matching language
    const langMatched = candidates.find(c => c.langMatch);
    if (langMatched) return langMatched.content;

    // Priority 2: first description without language info (infer from parent order - English tends to be first)
    const noLang = candidates.filter(c => !c.hasLang);
    if (noLang.length > 0) {
      // If we want English, take the first; if Dutch, take the last (heuristic)
      return lang === 'en' ? noLang[0].content : noLang[noLang.length - 1].content;
    }

    // Priority 3: any description from subject_of
    if (candidates.length > 0) return candidates[0].content;

    // Then check referred_to_by
    const refs = obj.referred_to_by ?? [];
    for (const ref of refs) {
      if (ref.type === 'LinguisticObject' &&
          RijksmuseumApiClient.hasClassification(ref.classified_as as LinkedArtClassification[], AAT.DESCRIPTION) &&
          RijksmuseumApiClient.languageMatches(ref.language, lang) &&
          ref.content) {
        return ref.content;
      }
    }

    // Fallback: any description regardless of language
    for (const ref of refs) {
      if (ref.type === 'LinguisticObject' &&
          RijksmuseumApiClient.hasClassification(ref.classified_as as LinkedArtClassification[], AAT.DESCRIPTION) &&
          ref.content) {
        return ref.content;
      }
    }

    return null;
  }

  static extractDimensions(obj: LinkedArtHumanMadeObject): Array<{ type: string; value: number; unit: string }> {
    const dims = obj.dimension ?? [];
    return dims
      .map(d => {
        // Map classified_as to dimension type using RKM_DIMENSION_TYPES
        let dimType = 'unknown';
        for (const cls of d.classified_as ?? []) {
          if (RKM_DIMENSION_TYPES[cls.id]) {
            dimType = RKM_DIMENSION_TYPES[cls.id];
            break;
          }
        }

        // Map unit
        let unit = 'unknown';
        if (d.unit?.id === AAT.UNIT_CM) unit = 'cm';
        else if (d.unit?.id === AAT.UNIT_KG) unit = 'kg';
        else if (d.unit?._label) unit = d.unit._label;

        return { type: dimType, value: d.value, unit };
      })
      .filter(d => d.type !== 'unknown');
  }

  static extractInscriptions(obj: LinkedArtHumanMadeObject, lang: string = 'en'): string[] {
    const refs = obj.referred_to_by ?? [];
    const inscriptions: string[] = [];

    // First pass: preferred language
    for (const ref of refs) {
      if (ref.type === 'LinguisticObject' &&
          RijksmuseumApiClient.hasClassification(ref.classified_as, AAT.INSCRIPTION) &&
          RijksmuseumApiClient.languageMatches(ref.language, lang) &&
          ref.content) {
        inscriptions.push(ref.content);
      }
    }

    if (inscriptions.length > 0) return inscriptions;

    // Fallback: any language
    for (const ref of refs) {
      if (ref.type === 'LinguisticObject' &&
          RijksmuseumApiClient.hasClassification(ref.classified_as, AAT.INSCRIPTION) &&
          ref.content) {
        inscriptions.push(ref.content);
      }
    }

    return inscriptions;
  }

  static extractMaterialRefs(obj: LinkedArtHumanMadeObject): string[] {
    // Return material entity IDs for async resolution
    return (obj.made_of ?? []).map(m => m.id).filter(Boolean);
  }

  private async resolveMaterialNames(obj: LinkedArtHumanMadeObject, lang: string = 'en'): Promise<string[]> {
    const materialIds = RijksmuseumApiClient.extractMaterialRefs(obj);
    if (materialIds.length === 0) return [];

    const settled = await Promise.allSettled(
      materialIds.map(async (id) => {
        const material = await this.resolveEntity<{
          identified_by?: Array<{ type: string; content: string; language?: Array<{ id: string }>; classified_as?: Array<{ id: string }> }>;
          _label?: string;
        }>(id);
        // Find name in preferred language
        const names = material.identified_by?.filter(i => i.type === 'Name') ?? [];
        const langUri = lang === 'nl' ? AAT.LANG_NL : AAT.LANG_EN;
        const preferred = names.find(n => n.language?.some(l => l.id === langUri));
        if (preferred?.content) return preferred.content;
        // Fallback: primary name
        const primary = names.find(n => n.classified_as?.some(c => c.id === AAT.PRIMARY_NAME));
        if (primary?.content) return primary.content;
        // Fallback: any name or _label
        return names[0]?.content ?? material._label ?? null;
      })
    );

    const names: string[] = [];
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value !== null) {
        names.push(r.value);
      }
    }
    return names;
  }

  static extractWebUrl(obj: LinkedArtHumanMadeObject): string | null {
    const subjectOf = obj.subject_of ?? [];
    for (const entry of subjectOf) {
      if ('classified_as' in entry && RijksmuseumApiClient.hasClassification(
        (entry as LinkedArtLinguisticObject).classified_as, AAT.WEB_PAGE)) {
        return entry.id ?? null;
      }
    }
    return null;
  }

  // --- Public methods ---

  async searchCollection(params: SearchArtworkArguments): Promise<LinkedArtSearchResponse> {
    const apiParams: Record<string, string> = {};

    if (params.title) apiParams.title = params.title;
    if (params.objectNumber) apiParams.objectNumber = params.objectNumber;
    if (params.creator) apiParams.creator = params.creator;
    if (params.creationDate) apiParams.creationDate = params.creationDate;
    if (params.description) apiParams.description = params.description;
    if (params.type) apiParams.type = params.type;
    if (params.technique) apiParams.technique = params.technique;
    if (params.material) apiParams.material = params.material;
    if (params.aboutActor) apiParams.aboutActor = params.aboutActor;
    if (params.imageAvailable !== undefined) apiParams.imageAvailable = String(params.imageAvailable);
    if (params.pageToken) apiParams.pageToken = params.pageToken;

    const response = await this.axiosInstance.get<LinkedArtSearchResponse>('/search/collection', {
      params: apiParams,
    });

    return response.data;
  }

  async getArtworkById(id: string): Promise<LinkedArtHumanMadeObject> {
    // Accept numeric ID or full URL
    let url: string;
    if (id.startsWith('http')) {
      url = id;
    } else {
      url = `${this.BASE_URL}/${id}`;
    }
    return this.resolveEntity<LinkedArtHumanMadeObject>(url);
  }

  async searchArtworks(params: SearchArtworkArguments): Promise<ArtworkSearchResponse> {
    const searchResponse = await this.searchCollection(params);

    // Resolve each result in parallel with concurrency limit
    const refs = searchResponse.orderedItems ?? [];
    const results: ArtworkSearchResult[] = [];

    for (let i = 0; i < refs.length; i += CONCURRENCY_LIMIT) {
      const batch = refs.slice(i, i + CONCURRENCY_LIMIT);
      const settled = await Promise.allSettled(
        batch.map(async (ref) => {
          const obj = await this.resolveEntity<LinkedArtHumanMadeObject>(ref.id);
          const imageUrl = await this.resolveImageUrl(obj);
          return {
            id: obj.id,
            objectNumber: RijksmuseumApiClient.extractObjectNumber(obj),
            title: RijksmuseumApiClient.extractTitle(obj),
            artist: RijksmuseumApiClient.extractArtist(obj),
            date: RijksmuseumApiClient.extractDates(obj).display,
            imageUrl,
          } satisfies ArtworkSearchResult;
        })
      );

      for (const result of settled) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
    }

    // Extract next page token from the next link
    let nextPageToken: string | null = null;
    if (searchResponse.next?.id) {
      const nextUrl = new URL(searchResponse.next.id);
      nextPageToken = nextUrl.searchParams.get('pageToken');
    }

    return {
      totalItems: searchResponse.partOf?.totalItems ?? refs.length,
      items: results,
      nextPageToken,
    };
  }

  async getArtworkDetails(id: string): Promise<ArtworkDetails> {
    const obj = await this.getArtworkById(id);
    // Resolve image and materials in parallel
    const [imageUrl, materials] = await Promise.all([
      this.resolveImageUrl(obj),
      this.resolveMaterialNames(obj),
    ]);

    return {
      id: obj.id,
      objectNumber: RijksmuseumApiClient.extractObjectNumber(obj),
      title: RijksmuseumApiClient.extractTitle(obj),
      titles: RijksmuseumApiClient.extractAllTitles(obj),
      artist: RijksmuseumApiClient.extractArtist(obj),
      date: RijksmuseumApiClient.extractDates(obj),
      description: RijksmuseumApiClient.extractDescription(obj),
      dimensions: RijksmuseumApiClient.extractDimensions(obj),
      materials,
      inscriptions: RijksmuseumApiClient.extractInscriptions(obj),
      imageUrl,
      webUrl: RijksmuseumApiClient.extractWebUrl(obj),
      linkedArtUrl: obj.id,
    };
  }

  async getImageUrl(id: string): Promise<string | null> {
    const obj = await this.getArtworkById(id);
    return this.resolveImageUrl(obj);
  }

  async getArtistTimeline(artist: string, maxWorks: number = 10): Promise<TimelineArtwork[]> {
    if (!artist) {
      throw new Error('Artist name is required');
    }

    const searchResponse = await this.searchArtworks({
      creator: artist,
      imageAvailable: true,
    });

    // Take up to maxWorks items
    const items = searchResponse.items.slice(0, maxWorks);

    // Map to timeline artworks and sort by parsed year client-side
    const timelineWorks: TimelineArtwork[] = items.map(item => {
      const year = item.date?.match(/\d{4}/)?.[0] ?? 'Unknown';
      return {
        year,
        title: item.title,
        objectNumber: item.objectNumber,
        description: item.artist ? `${item.title} - ${item.artist}, ${item.date ?? 'date unknown'}` : null,
        image: item.imageUrl,
      };
    });

    // Sort chronologically
    timelineWorks.sort((a, b) => {
      const yearA = parseInt(a.year) || 0;
      const yearB = parseInt(b.year) || 0;
      return yearA - yearB;
    });

    return timelineWorks;
  }
}
