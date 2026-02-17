![rijksmuseum logo](https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Logo_Rijksmuseum.svg/799px-Logo_Rijksmuseum.svg.png)

# Rijksmuseum MCP Server

A Model Context Protocol (MCP) server that provides access to the Rijksmuseum's collection through natural language interactions. This server enables AI models to explore, analyze, and interact with artworks and collections from the Rijksmuseum.

Uses the Rijksmuseum's [Linked Art API](https://data.rijksmuseum.nl) — no API key required.

<a href="https://glama.ai/mcp/servers/4rmiexp64y"><img width="380" height="200" src="https://glama.ai/mcp/servers/4rmiexp64y/badge" alt="Rijksmuseum Server MCP server" /></a>

## Features

The server provides 5 tools for interacting with the Rijksmuseum's collection:

### 1. Search Artworks (`search_artwork`)
Search and filter artworks using various criteria including:
- Title, description, and object number
- Creator/artist name
- Artwork type (painting, print, drawing, etc.)
- Materials and techniques
- Creation date or date range
- Depicted persons (`aboutActor`)
- Image availability filter
- Token-based pagination for large result sets

Results are enriched with resolved titles, artists, dates, and IIIF image URLs.

### 2. Artwork Details (`get_artwork_details`)
Retrieve comprehensive information about specific artworks, including:
- Titles in multiple languages (Dutch and English)
- Artist attribution
- Creation dates (display string + ISO begin/end)
- Full-text description
- Physical dimensions (height, width, weight)
- Materials and inscriptions
- IIIF image URL and web URL

Accepts a Linked Art ID or object number (e.g., `SK-C-5`).

### 3. Artwork Image (`get_artwork_image`)
Get the IIIF Image API URL for an artwork:
- Full resolution image URL
- Base IIIF URL with example size variants (max, 800px, 400px, thumbnail)
- Compatible with any IIIF image viewer

### 4. Image Viewing (`open_image_in_browser`)
Open artwork images directly in your browser for detailed viewing.

### 5. Artist Timeline (`get_artist_timeline`)
Generate chronological timelines of artists' works:
- Track artistic development
- Analyze periods and styles
- Sorted chronologically with images

## Example Use Cases

Here are some example queries you can ask the AI when using this server:

### Artwork Discovery
```
"Show me all paintings by Rembrandt"
"Find artworks depicting biblical scenes"
"Search for drawings made with etching technique"
"What paintings on canvas are in the collection?"
```

### Artwork Analysis
```
"Tell me everything about The Night Watch"
"What are the dimensions and materials used in Van Gogh's Self Portrait?"
"Show me the high-resolution image of Vermeer's The Milkmaid"
"What inscriptions are on the Night Watch?"
```

### Artist Research
```
"Create a timeline of Rembrandt's works"
"Show me all works by Frans Hals"
"What techniques did Jan Steen use in his paintings?"
```

### Visual Exploration
```
"Open the Night Watch image in my browser"
"Get the IIIF image URL for SK-C-5 so I can view it at different sizes"
"Show me a thumbnail of The Syndics"
```

## Getting Started

### 1. Using Claude Desktop with NPM Package
Update your Claude configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "rijksmuseum-server": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-server-rijksmuseum"
      ]
    }
  }
}
```

No API key is required.

### 2. From Source
1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build:
   ```bash
   npm run build
   ```
4. Update your Claude configuration file:
   ```json
   {
     "mcpServers": {
       "rijksmuseum-server": {
         "command": "node",
         "args": [
           "/path/to/rijksmuseum-mcp/dist/index.js"
         ]
       }
     }
   }
   ```

Replace `/path/to/rijksmuseum-mcp` with the actual path to your installation.

After updating the configuration, restart Claude Desktop for the changes to take effect.

## API

This server uses the Rijksmuseum Linked Art API at `https://data.rijksmuseum.nl`. The API returns [Linked Art](https://linked.art/) JSON-LD data, which the server parses and presents in a simplified format.

Key implementation details:
- **No API key required** — the Linked Art API is open
- **Multi-hop image resolution** — resolving an image requires 3 HTTP calls (Object → VisualItem → DigitalObject → IIIF URL)
- **Parallel resolution** — search results are resolved concurrently (up to 10 at a time) to mitigate the multi-hop overhead
- **IIIF Image API** — all image URLs use the [IIIF Image API](https://iiif.io/api/image/3.0/) standard

For more information about the Rijksmuseum's data, visit the [Rijksmuseum Data Portal](https://data.rijksmuseum.nl).

## Contributing

Contributions are welcome! Please feel free to submit pull requests or create issues for bugs and feature requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
