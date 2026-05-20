from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """Application configuration from environment variables"""
    
    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = True
    
    # RSHub Configuration
    RSHUB_BASE_URL: str = "https://rshub.zju.edu.cn"
    
    # LLM Configuration - Support both OpenRouter and Volcengine Ark
    LLM_PROVIDER: str = "volcengine"  # "openrouter" or "volcengine"
    
    # OpenRouter settings
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "deepseek/deepseek-chat"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    
    # Volcengine Ark (DeepSeek) settings
    VOLCENGINE_BASE_URL: str = "https://ark.cn-beijing.volces.com/api/v3"
    VOLCENGINE_API_KEY: str = ""
    VOLCENGINE_MODEL: str = "deepseek-v3-2-251201"
    
    LLM_TEMPERATURE: float = 0.7
    LLM_MAX_TOKENS: int = 32000
    CHAT_HISTORY_WINDOW: int = 16
    
    # CORS Configuration
    CORS_ORIGINS: str = "http://localhost:3000,https://rshub.zju.edu.cn"
    CORS_ORIGINS_REGEX: str = ""
    
    # Credit Billing Configuration
    TASK_SUBMIT_COST: int = 1
    AGENT_CHAT_COST: int = 1
    
    # HITL (Human-in-the-Loop) Configuration - Disabled by default to maintain original behavior
    HITL_ENABLED: bool = False

    # Skill registry: tiered load (layer-1 catalog + layer-2 selected full_doc) to reduce tokens
    SKILL_TIERED_LOAD_ENABLED: bool = True
    
    # SSL Verification (set to false for development if certificate issues occur)
    VERIFY_SSL: bool = True
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins into a list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
    
    @property
    def cors_origin_regex(self) -> Optional[str]:
        """Optional regex for matching multiple origins (e.g., subdomains)"""
        return self.CORS_ORIGINS_REGEX or None

    def get_llm_config(self):
        """Return LLM configuration based on LLM_PROVIDER"""
        if self.LLM_PROVIDER.lower() == "openrouter":
            return {
                "base_url": self.OPENROUTER_BASE_URL,
                "api_key": self.OPENROUTER_API_KEY,
                "model": self.OPENROUTER_MODEL
            }
        else:  # default to volcengine
            return {
                "base_url": self.VOLCENGINE_BASE_URL,
                "api_key": self.VOLCENGINE_API_KEY,
                "model": self.VOLCENGINE_MODEL
            }

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()


def get_settings() -> Settings:
    """Get application settings"""
    return settings

