"""File system and web search tools for the coding agent.

Provides tools for file operations, code analysis, and web search.
All file operations are executed by the VSCode extension for security.
"""

from typing import Any, Callable, List, Optional, cast

from langchain_tavily import TavilySearch
from langgraph.runtime import get_runtime

from react_agent.context import Context


async def search(query: str) -> Optional[dict[str, Any]]:
    """Perform web search using Tavily search engine.

    Args:
        query: Search query string

    Returns:
        Search results dictionary or None if search fails
    """
    runtime = get_runtime(Context)
    wrapped = TavilySearch(max_results=runtime.context.max_search_results)
    return cast(dict[str, Any], await wrapped.ainvoke({"query": query}))


async def read_file(file_path: str) -> str:
    """Read file contents from workspace.
    
    Args:
        file_path: Relative path to the file in workspace
    
    Returns:
        File content string
    """
    return f"Reading file: {file_path}"


async def write_file(file_path: str, content: str) -> str:
    """Create or overwrite file in workspace.
    
    Args:
        file_path: Relative path where file should be created/written
        content: Content to write to the file
    
    Returns:
        Operation result message
    """
    return f"Writing {len(content)} bytes to file: {file_path}"


async def edit_file(file_path: str, old_text: str, new_text: str) -> str:
    """Edit file by replacing text content.
    
    Args:
        file_path: Relative path to file to edit
        old_text: Text to find and replace
        new_text: New text to replace with
    
    Returns:
        Operation result message
    """
    return f"Editing file: {file_path}"


async def delete_file(file_path: str) -> str:
    """Delete file from workspace.
    
    Args:
        file_path: Relative path to file to delete
    
    Returns:
        Operation result message
    """
    return f"Deleting file: {file_path}"


async def list_directory(directory_path: str = ".") -> str:
    """List directory contents.
    
    Args:
        directory_path: Relative path to directory (defaults to workspace root)
    
    Returns:
        Operation result message
    """
    return f"Listing directory: {directory_path}"


async def create_directory(directory_path: str) -> str:
    """Create directory in workspace.
    
    Args:
        directory_path: Relative path for new directory
    
    Returns:
        Operation result message
    """
    return f"Creating directory: {directory_path}"


async def get_workspace_info() -> str:
    """Get workspace information.
    
    Returns:
        Operation result message
    """
    return "Getting workspace information"


async def search_files(pattern: str) -> str:
    """Search files matching glob pattern.
    
    Args:
        pattern: Glob pattern (e.g., "**/*.py", "src/**/*.ts")
    
    Returns:
        Operation result message
    """
    return f"Searching files with pattern: {pattern}"


TOOLS: List[Callable[..., Any]] = [
    search,
    read_file,
    write_file,
    edit_file,
    delete_file,
    list_directory,
    create_directory,
    get_workspace_info,
    search_files,
]
