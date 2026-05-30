#!/usr/bin/env python3
"""Vault Query MCP Server — search and read wiki pages in the ObsidianVault."""

import os
import re
from pathlib import Path

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

WIKI_ROOT = Path(os.environ.get("VAULT_WIKI_ROOT", Path(__file__).parent.parent.parent / "wiki"))

app = Server("vault-query")


def _get_domains() -> list[str]:
    if not WIKI_ROOT.exists():
        return []
    return sorted(p.name for p in WIKI_ROOT.iterdir() if p.is_dir())


@app.list_tools()
async def list_tools() -> list[Tool]:
    domains = _get_domains()
    domain_desc = f"Optional domain filter. One of: {', '.join(domains)}" if domains else "Optional domain filter."
    return [
        Tool(
            name="search_wiki",
            description=(
                "Full-text search across wiki pages. Returns ranked excerpts with page paths. "
                "Use this to find relevant pages before reading them in full."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search terms — plain text, case-insensitive"
                    },
                    "domain": {
                        "type": "string",
                        "description": domain_desc
                    },
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="read_wiki_page",
            description="Read a specific wiki page by path relative to wiki/.",
            inputSchema={
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Path relative to wiki/, e.g. 'health-fitness/garmin-venu4.md'"
                    },
                },
                "required": ["path"]
            }
        ),
        Tool(
            name="list_wiki_pages",
            description="List all wiki pages with their paths, optionally filtered by domain.",
            inputSchema={
                "type": "object",
                "properties": {
                    "domain": {
                        "type": "string",
                        "description": domain_desc
                    },
                },
            }
        ),
        Tool(
            name="get_wiki_index",
            description="Get the full wiki index — the master catalog of all pages. Read this first to orient.",
            inputSchema={
                "type": "object",
                "properties": {},
            }
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "search_wiki":
        return _search_wiki(arguments["query"], arguments.get("domain"))
    elif name == "read_wiki_page":
        return _read_wiki_page(arguments["path"])
    elif name == "list_wiki_pages":
        return _list_wiki_pages(arguments.get("domain"))
    elif name == "get_wiki_index":
        return _get_wiki_index()
    else:
        return [TextContent(type="text", text=f"Unknown tool: {name}")]


def _search_wiki(query: str, domain: str | None = None) -> list[TextContent]:
    search_root = WIKI_ROOT / domain if domain else WIKI_ROOT

    if not search_root.exists():
        available = ", ".join(_get_domains())
        return [TextContent(type="text", text=f"Domain not found: {domain}. Available: {available}")]

    pattern = re.compile(re.escape(query), re.IGNORECASE)
    results = []

    for md_file in sorted(search_root.rglob("*.md")):
        if md_file.name in ("index.md", "log.md"):
            continue

        try:
            content = md_file.read_text(encoding="utf-8")
        except Exception:
            continue

        lines = content.split("\n")
        match_excerpts = []

        for i, line in enumerate(lines):
            if pattern.search(line):
                start = max(0, i - 2)
                end = min(len(lines), i + 3)
                excerpt = "\n".join(lines[start:end]).strip()
                match_excerpts.append(excerpt)

        if match_excerpts:
            relative_path = md_file.relative_to(WIKI_ROOT)
            score = sum(
                3 if re.match(r"^#+ ", line) else 1
                for line in lines
                if pattern.search(line)
            )
            results.append((score, str(relative_path), match_excerpts[:3]))

    results.sort(key=lambda x: x[0], reverse=True)

    if not results:
        domain_note = f" in domain '{domain}'" if domain else ""
        return [TextContent(type="text", text=f"No results found for '{query}'{domain_note}.")]

    output_parts = [f"Search results for '{query}' — {len(results)} page(s) matched:\n"]

    for score, path, excerpts in results[:10]:
        output_parts.append(f"### {path}")
        for excerpt in excerpts:
            output_parts.append(f"```\n{excerpt}\n```")

    return [TextContent(type="text", text="\n\n".join(output_parts))]


def _read_wiki_page(path: str) -> list[TextContent]:
    full_path = WIKI_ROOT / path

    if not full_path.exists():
        # Try adding .md if not present
        if not path.endswith(".md"):
            full_path = WIKI_ROOT / (path + ".md")

    if not full_path.exists():
        return [TextContent(type="text", text=f"Page not found: {path}")]

    try:
        content = full_path.read_text(encoding="utf-8")
        return [TextContent(type="text", text=f"# {path}\n\n{content}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error reading {path}: {e}")]


def _list_wiki_pages(domain: str | None = None) -> list[TextContent]:
    search_root = WIKI_ROOT / domain if domain else WIKI_ROOT

    if not search_root.exists():
        available = ", ".join(_get_domains())
        return [TextContent(type="text", text=f"Domain not found: {domain}. Available: {available}")]

    pages = []
    for md_file in sorted(search_root.rglob("*.md")):
        relative_path = md_file.relative_to(WIKI_ROOT)
        pages.append(str(relative_path))

    if not pages:
        return [TextContent(type="text", text="No pages found.")]

    output = f"Wiki pages ({len(pages)} total):\n\n" + "\n".join(f"- {p}" for p in pages)
    return [TextContent(type="text", text=output)]


def _get_wiki_index() -> list[TextContent]:
    index_path = WIKI_ROOT / "index.md"

    if not index_path.exists():
        return [TextContent(type="text", text="index.md not found.")]

    try:
        content = index_path.read_text(encoding="utf-8")
        return [TextContent(type="text", text=content)]
    except Exception as e:
        return [TextContent(type="text", text=f"Error reading index.md: {e}")]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
