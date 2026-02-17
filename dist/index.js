#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RijksmuseumApiClient } from "./api/RijksmuseumApiClient.js";
import { ToolHandler } from "./handlers/ToolHandler.js";
import { ResourceHandler } from "./handlers/ResourceHandler.js";
import { PromptHandler } from "./handlers/PromptHandler.js";
import { ErrorHandler } from "./error/ErrorHandler.js";
class RijksmuseumServer {
    constructor() {
        // Initialize API client (no API key needed for new Linked Art API)
        this.apiClient = new RijksmuseumApiClient();
        // Initialize handlers
        this.toolHandler = new ToolHandler(this.apiClient);
        this.resourceHandler = new ResourceHandler(this.apiClient);
        this.promptHandler = new PromptHandler();
        // Initialize server
        this.server = new Server({
            name: "rijksmuseum-server",
            version: "0.1.0"
        }, {
            capabilities: {
                tools: {},
                resources: {},
                prompts: {}
            }
        });
        this.setupHandlers();
        this.setupErrorHandling();
    }
    setupErrorHandling() {
        this.server.onerror = (error) => {
            console.error("[MCP Error]", error);
        };
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    setupHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: "search_artwork",
                    description: "Search and filter artworks in the Rijksmuseum collection using the Linked Art API. Returns enriched results with resolved titles, artists, dates, and image URLs. Note: each search result requires multiple API calls to resolve details, so results may take a moment.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            title: {
                                type: "string",
                                description: "Search by artwork title. Example: 'Night Watch', 'Milkmaid'."
                            },
                            objectNumber: {
                                type: "string",
                                description: "Search by object number. Example: 'SK-C-5'."
                            },
                            creator: {
                                type: "string",
                                description: "Search by creator/artist name. Example: 'Rembrandt', 'Vermeer'."
                            },
                            creationDate: {
                                type: "string",
                                description: "Search by creation date or date range. Example: '1642', '1600-1700'."
                            },
                            description: {
                                type: "string",
                                description: "Search within artwork descriptions."
                            },
                            type: {
                                type: "string",
                                description: "Filter by artwork type. Example: 'painting', 'print', 'drawing'."
                            },
                            technique: {
                                type: "string",
                                description: "Filter by technique. Example: 'oil paint', 'etching'."
                            },
                            material: {
                                type: "string",
                                description: "Filter by material. Example: 'canvas', 'paper', 'panel'."
                            },
                            aboutActor: {
                                type: "string",
                                description: "Search for artworks depicting or about a specific person."
                            },
                            imageAvailable: {
                                type: "boolean",
                                description: "When true, only returns artworks that have digital images available."
                            },
                            pageToken: {
                                type: "string",
                                description: "Token for fetching the next page of results. Obtained from the nextPageToken field of a previous search response."
                            }
                        }
                    }
                },
                {
                    name: "get_artwork_details",
                    description: "Retrieve comprehensive details about a specific artwork from the Rijksmuseum collection via the Linked Art API. Returns titles, artist, dates, description, dimensions, materials, inscriptions, image URL, and web URL.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            id: {
                                type: "string",
                                description: "The Linked Art ID (URL) of the artwork, e.g., 'https://data.rijksmuseum.nl/object/12345'. Can also be a numeric ID."
                            },
                            objectNumber: {
                                type: "string",
                                description: "The object number of the artwork, e.g., 'SK-C-5'. If provided instead of id, a search will be performed first to find the artwork."
                            }
                        }
                    }
                },
                {
                    name: "get_artwork_image",
                    description: "Retrieve the IIIF image URL for an artwork. Returns a IIIF Image API URL that can be used to access the image at various sizes. The base URL can be modified with IIIF parameters for different sizes (e.g., /full/800,/0/default.jpg for 800px width).",
                    inputSchema: {
                        type: "object",
                        properties: {
                            id: {
                                type: "string",
                                description: "The Linked Art ID (URL) of the artwork."
                            },
                            objectNumber: {
                                type: "string",
                                description: "The object number of the artwork, e.g., 'SK-C-5'. If provided instead of id, a search will be performed first."
                            }
                        }
                    }
                },
                {
                    name: "open_image_in_browser",
                    description: "Open a high-resolution image of an artwork in the default web browser for viewing. Works with any valid image URL including IIIF URLs.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            imageUrl: {
                                type: "string",
                                description: "The full URL of the artwork image to open. Can be a IIIF URL or any valid HTTP/HTTPS image URL."
                            }
                        },
                        required: ["imageUrl"]
                    }
                },
                {
                    name: "get_artist_timeline",
                    description: "Generate a chronological timeline of an artist's works in the Rijksmuseum collection. Searches by creator name, resolves artwork details and images, then sorts chronologically.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            artist: {
                                type: "string",
                                description: "The name of the artist to create a timeline for. Example: 'Rembrandt van Rijn', 'Vincent van Gogh'."
                            },
                            maxWorks: {
                                type: "number",
                                description: "Maximum number of works to include in the timeline.",
                                minimum: 1,
                                maximum: 50,
                                default: 10
                            }
                        },
                        required: ["artist"]
                    }
                }
            ]
        }));
        // Handle tool execution
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            return await this.toolHandler.handleToolRequest(request);
        });
        // Handle resource requests
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            return await this.resourceHandler.listResources();
        });
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            return await this.resourceHandler.readResource(request.params.uri);
        });
        // Handle prompt requests
        this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
            return this.promptHandler.listPrompts();
        });
        this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
            return this.promptHandler.getPrompt(request.params.name, request.params.arguments || {});
        });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Rijksmuseum MCP server running on stdio");
    }
}
// Start the server
const server = new RijksmuseumServer();
server.run().catch((error) => {
    ErrorHandler.handleError(error);
});
