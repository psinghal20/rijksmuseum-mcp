// Getty AAT vocabulary URIs used by the Rijksmuseum Linked Art API
export const AAT = {
  // Languages
  LANG_EN: 'http://vocab.getty.edu/aat/300388277',
  LANG_NL: 'http://vocab.getty.edu/aat/300388256',

  // Identifier types
  OBJECT_NUMBER: 'http://vocab.getty.edu/aat/300312355',

  // Name types
  PRIMARY_NAME: 'http://vocab.getty.edu/aat/300404670',

  // Title types
  TITLE: 'http://vocab.getty.edu/aat/300417200',
  DISPLAY_TITLE: 'http://vocab.getty.edu/aat/300417207',

  // Description types
  DESCRIPTION: 'http://vocab.getty.edu/aat/300048722',
  INSCRIPTION: 'http://vocab.getty.edu/aat/300435414',
  CREATOR_DESCRIPTION: 'http://vocab.getty.edu/aat/300435416',
  CREATOR_LABEL: 'http://vocab.getty.edu/aat/300435417',

  // Dimension units
  UNIT_CM: 'http://vocab.getty.edu/aat/300379098',
  UNIT_KG: 'http://vocab.getty.edu/aat/300379226',

  // Web page
  WEB_PAGE: 'http://vocab.getty.edu/aat/300379475',
} as const;

// Rijksmuseum-specific dimension type IDs (from id.rijksmuseum.nl)
export const RKM_DIMENSION_TYPES: Record<string, string> = {
  'https://id.rijksmuseum.nl/22011': 'height',
  'https://id.rijksmuseum.nl/22012': 'width',
  'https://id.rijksmuseum.nl/220217': 'weight',
};

// --- Raw Linked Art types (as returned by the API) ---

export interface LinkedArtRef {
  id: string;
  type: string;
}

export interface LinkedArtClassification {
  id: string;
  type: string;
  _label?: string;
}

export interface LinkedArtName {
  type: 'Name';
  content: string;
  language?: LinkedArtRef[];
  classified_as?: LinkedArtClassification[];
}

export interface LinkedArtIdentifier {
  type: 'Identifier';
  content: string;
  classified_as?: LinkedArtClassification[];
}

export interface LinkedArtLinguisticObject {
  id?: string;
  type: 'LinguisticObject';
  content?: string;
  language?: LinkedArtRef[];
  classified_as?: LinkedArtClassification[];
  part?: LinkedArtLinguisticObject[];
}

export interface LinkedArtTimeSpan {
  type: 'TimeSpan';
  _label?: string;
  identified_by?: Array<LinkedArtName | LinkedArtIdentifier>;
  begin_of_the_begin?: string;
  end_of_the_end?: string;
}

export interface LinkedArtProduction {
  type: 'Production';
  timespan?: LinkedArtTimeSpan;
  referred_to_by?: LinkedArtLinguisticObject[];
}

export interface LinkedArtDimension {
  type: 'Dimension';
  value: number;
  classified_as?: LinkedArtClassification[];
  unit?: LinkedArtClassification;
}

export interface LinkedArtMaterial {
  id: string;
  type: string;
  _label?: string;
  identified_by?: Array<{ type: string; content: string }>;
}

export interface LinkedArtVisualItem {
  id: string;
  type: 'VisualItem';
  digitally_shown_by?: LinkedArtRef[];
}

export interface LinkedArtDigitalObject {
  id: string;
  type: 'DigitalObject';
  access_point?: LinkedArtRef[];
}

export interface LinkedArtHumanMadeObject {
  '@context'?: string;
  id: string;
  type: 'HumanMadeObject';
  identified_by?: Array<LinkedArtName | LinkedArtIdentifier>;
  produced_by?: LinkedArtProduction;
  referred_to_by?: LinkedArtLinguisticObject[];
  subject_of?: Array<LinkedArtLinguisticObject | LinkedArtRef>;
  dimension?: LinkedArtDimension[];
  made_of?: LinkedArtMaterial[];
  shows?: LinkedArtRef[];
}

export interface LinkedArtSearchResponse {
  '@context'?: string;
  type: string;
  id: string;
  partOf?: {
    id: string;
    type: string;
    totalItems: number;
    first?: LinkedArtRef;
    last?: LinkedArtRef;
  };
  orderedItems: LinkedArtRef[];
  next?: LinkedArtRef;
}

// --- Processed output types ---

export interface SearchArtworkArguments {
  title?: string;
  objectNumber?: string;
  creator?: string;
  creationDate?: string;
  description?: string;
  type?: string;
  technique?: string;
  material?: string;
  aboutActor?: string;
  imageAvailable?: boolean;
  pageToken?: string;
}

export interface ArtworkSearchResult {
  id: string;
  objectNumber: string | null;
  title: string | null;
  artist: string | null;
  date: string | null;
  imageUrl: string | null;
}

export interface ArtworkSearchResponse {
  totalItems: number;
  items: ArtworkSearchResult[];
  nextPageToken: string | null;
}

export interface ArtworkDetails {
  id: string;
  objectNumber: string | null;
  title: string | null;
  titles: Array<{ title: string; language: string | null; type: string | null }>;
  artist: string | null;
  date: { display: string | null; begin: string | null; end: string | null };
  description: string | null;
  dimensions: Array<{ type: string; value: number; unit: string }>;
  materials: string[];
  inscriptions: string[];
  imageUrl: string | null;
  webUrl: string | null;
  linkedArtUrl: string;
}

export interface TimelineArtwork {
  year: string;
  title: string | null;
  objectNumber: string | null;
  description: string | null;
  image: string | null;
}

export interface OpenImageArguments {
  imageUrl: string;
}

export interface Prompt {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}
