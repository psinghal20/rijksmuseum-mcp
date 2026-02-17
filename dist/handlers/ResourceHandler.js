import { ErrorHandler } from "../error/ErrorHandler.js";
export class ResourceHandler {
    constructor(apiClient) {
        this.apiClient = apiClient;
    }
    async listResources() {
        return {
            resources: [{
                    uri: "art://collection/popular",
                    name: "Popular Artworks",
                    mimeType: "application/json",
                    description: "Most viewed artworks in the collection"
                }]
        };
    }
    async readResource(uri) {
        try {
            switch (uri) {
                case "art://collection/popular":
                    const response = await this.apiClient.searchArtworks({
                        imageAvailable: true,
                    });
                    return {
                        contents: [{
                                uri,
                                mimeType: "application/json",
                                text: JSON.stringify(response.items.slice(0, 10), null, 2)
                            }]
                    };
                default:
                    throw new Error(`Resource not found: ${uri}`);
            }
        }
        catch (error) {
            ErrorHandler.handleError(error);
        }
    }
}
