import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    db_host: str = "localhost"
    db_user: str = "root"
    db_password: str = ""
    db_name: str = "clinica_funeraria"
    db_port: int = 3306

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
