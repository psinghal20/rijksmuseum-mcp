import { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { RijksmuseumApiClient } from "../api/RijksmuseumApiClient.js";
import { ErrorHandler } from "../error/ErrorHandler.js";
import { isSearchArtworkArguments, isOpenImageArguments } from "../utils/typeGuards.js";
import { SystemIntegration } from "../utils/SystemIntegration.js";

export class ToolHandler {
  constructor(private apiClient: RijksmuseumApiClient) {}

  async handleToolRequest(request: CallToolRequest) {
    try {
      switch (request.params.name) {
        case "search_artwork":
          return await this.handleSearchArtwork(request);
        case "get_artwork_details":
          return await this.handleGetArtworkDetails(request);
        case "get_artwork_image":
          return await this.handleGetArtworkImage(request);
        case "open_image_in_browser":
          return await this.handleOpenImageInBrowser(request);
        case "get_artist_timeline":
          return await this.handleGetArtistTimeline(request);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      ErrorHandler.handleError(error);
    }
  }

  private async handleSearchArtwork(request: CallToolRequest) {
    if (!isSearchArtworkArguments(request.params.arguments)) {
      throw new Error("Invalid arguments for search_artwork. At least one search parameter is required.");
    }

    const response = await this.apiClient.searchArtworks(request.params.arguments);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          totalItems: response.totalItems,
          count: response.items.length,
          nextPageToken: response.nextPageToken,
          artworks: response.items
        }, null, 2)
      }]
    };
  }

  private async handleGetArtworkDetails(request: CallToolRequest) {
    const { id, objectNumber } = request.params.arguments as { id?: string; objectNumber?: string };

    if (!id && !objectNumber) {
      throw new Error("Either 'id' or 'objectNumber' is required for get_artwork_details");
    }

    let artworkId = id;

    // If only objectNumber is provided, search for it first
    if (!artworkId && objectNumber) {
      const searchResult = await this.apiClient.searchArtworks({ objectNumber });
      if (searchResult.items.length === 0) {
        throw new Error(`No artwork found with object number: ${objectNumber}`);
      }
      artworkId = searchResult.items[0].id;
    }

    const details = await this.apiClient.getArtworkDetails(artworkId!);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(details, null, 2)
      }]
    };
  }

  private async handleGetArtworkImage(request: CallToolRequest) {
    const { id, objectNumber } = request.params.arguments as { id?: string; objectNumber?: string };

    if (!id && !objectNumber) {
      throw new Error("Either 'id' or 'objectNumber' is required for get_artwork_image");
    }

    let artworkId = id;

    // If only objectNumber is provided, search for it first
    if (!artworkId && objectNumber) {
      const searchResult = await this.apiClient.searchArtworks({ objectNumber });
      if (searchResult.items.length === 0) {
        throw new Error(`No artwork found with object number: ${objectNumber}`);
      }
      artworkId = searchResult.items[0].id;
    }

    const imageUrl = await this.apiClient.getImageUrl(artworkId!);

    if (!imageUrl) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ error: "No image available for this artwork" }, null, 2)
        }],
        isError: true
      };
    }

    // Extract base IIIF URL (everything before /full/...)
    const iiifBase = imageUrl.replace(/\/full\/.*$/, '');

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          imageUrl,
          iiifBaseUrl: iiifBase,
          exampleSizes: {
            max: `${iiifBase}/full/max/0/default.jpg`,
            width800: `${iiifBase}/full/800,/0/default.jpg`,
            width400: `${iiifBase}/full/400,/0/default.jpg`,
            thumbnail: `${iiifBase}/full/200,/0/default.jpg`,
          }
        }, null, 2)
      }]
    };
  }

  private async handleOpenImageInBrowser(request: CallToolRequest) {
    if (!isOpenImageArguments(request.params.arguments)) {
      throw new Error("Invalid arguments for open_image_in_browser");
    }

    try {
      await SystemIntegration.openInBrowser(request.params.arguments.imageUrl);
      return {
        content: [{
          type: "text",
          text: `Successfully opened image in browser: ${request.params.arguments.imageUrl}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to open image in browser: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }

  private async handleGetArtistTimeline(request: CallToolRequest) {
    const { artist, maxWorks = 10 } = request.params.arguments as { artist: string; maxWorks?: number };
    ErrorHandler.validateRequiredParam(artist, 'artist');

    const timelineArtworks = await this.apiClient.getArtistTimeline(artist, maxWorks);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          artist,
          works: timelineArtworks
        }, null, 2)
      }]
    };
  }
}
