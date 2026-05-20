"""
Tool registry for managing and executing tools
"""

import logging
from typing import Dict, Any, List
from .base import BaseTool

logger = logging.getLogger(__name__)


class ToolRegistry:
    """Registry for managing agent tools"""
    
    def __init__(self):
        self.tools: Dict[str, BaseTool] = {}
    
    def register(self, tool: BaseTool):
        """Register a tool"""
        self.tools[tool.name] = tool
        logger.info(f"Registered tool: {tool.name}")
    
    def get_tools_schema(self) -> List[Dict[str, Any]]:
        """Get OpenAI-compatible tools schema"""
        return [tool.to_openai_schema() for tool in self.tools.values()]
    
    async def execute_tool(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        """Execute a tool by name"""
        if tool_name not in self.tools:
            logger.error(f"Tool not found: {tool_name}")
            return {
                "success": False,
                "error": f"Tool {tool_name} not found"
            }
        
        try:
            logger.info(f"Executing tool: {tool_name} with params: {kwargs}")
            result = await self.tools[tool_name].execute(**kwargs)
            return result
        except Exception as e:
            logger.error(f"Tool {tool_name} execution failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    def list_tools(self) -> List[str]:
        """List all registered tool names"""
        return list(self.tools.keys())

