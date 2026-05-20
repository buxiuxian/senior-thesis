"""
Tool for fetching scientific paper full text
"""

import logging
from pathlib import Path
from typing import Dict, Any
from .base import BaseTool

logger = logging.getLogger(__name__)


class FetchPaperTool(BaseTool):
    """Tool to fetch full text of scientific papers"""
    
    def __init__(self, papers_dir: str = "app/prompts/papers"):
        self.papers_dir = Path(papers_dir)
    
    @property
    def name(self) -> str:
        return "fetch_paper_fulltext"
    
    @property
    def description(self) -> str:
        return """Fetch the full text content of a scientific paper about RSHub models.
Use this when user asks for detailed paper content, methodology, equations, or full text.
Available papers:
- Paper 1: DMRT-BIC model for snow (bicontinuous model, dense aggregates)
- Paper 2: DMRT-QMS model for snow (quasi-crystalline approximation, sticky particles)
- Paper 3: DMRT-TRI model for wet snow (tri-continuous random medium, DDA)
- Paper 4: Vegetation VPRT model (passive RT, vertical heterogeneity)
- Paper 5: NMM3D soil model (full-wave Maxwell, rough surfaces, SMAP)
- Paper 6: NMM3D snow/DDA model (full-wave, bicontinuous media, half-space)
- Paper 7: DMRT active+passive snow (cyclical corrections, NoSREx)
- Paper 8: RT forest active+passive (multiple scattering, SMAPVEX12)"""
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "paper_id": {
                    "type": "integer",
                    "description": "The numeric identifier of the paper (1-8). 1=DMRT-BIC, 2=DMRT-QMS, 3=DMRT-TRI, 4=VPRT vegetation, 5=NMM3D soil, 6=NMM3D snow/DDA, 7=DMRT active+passive snow, 8=RT forest"
                }
            },
            "required": ["paper_id"]
        }
    
    async def execute(self, paper_id: int) -> Dict[str, Any]:
        """Fetch paper from papers directory"""
        try:
            # Try different file extensions
            paper_file = None
            for ext in ['.txt', '.md']:
                potential_file = self.papers_dir / f"{paper_id}{ext}"
                if potential_file.exists():
                    paper_file = potential_file
                    break
            
            if not paper_file:
                logger.warning(f"Paper {paper_id} not found in {self.papers_dir}")
                return {
                    "success": False,
                    "error": f"Paper {paper_id} not found. Available papers: 1-8"
                }
            
            with open(paper_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Limit content to avoid token overflow (keep first 64000 chars ~16000 tokens)
            if len(content) > 64000:
                content = content[:64000] + "\n\n... (content truncated due to length)"
            
            logger.info(f"Successfully fetched paper: {paper_id} ({len(content)} chars)")
            return {
                "success": True,
                "paper_id": paper_id,
                "content": content,
                "note": "Use this content to answer user's questions about the paper"
            }
        
        except Exception as e:
            logger.error(f"Error fetching paper {paper_id}: {e}")
            return {
                "success": False,
                "error": f"Failed to fetch paper: {str(e)}"
            }

