import os

BASE_URL = os.getenv("MIMO_BASE_URL", "https://token-plan-cn.xiaomimimo.com/v1")
MODEL = os.getenv("MIMO_MODEL", "mimo-v2-omni")

# Key 优先取环境变量；否则从 gitignored 的 config_local.py 读取（打包时随之编入二进制）。
API_KEY = os.getenv("MIMO_API_KEY", "")
if not API_KEY:
    try:
        from backend.config_local import API_KEY as _LOCAL_KEY

        API_KEY = _LOCAL_KEY
    except ImportError:
        API_KEY = ""
