import os

# ===== 阿里云百炼 DashScope（语音识别，当前使用）=====
# qwen3-asr-flash：OpenAI 兼容接口，国内可用，单词识别约 0.5 秒且准确。
ALIYUN_BASE_URL = os.getenv("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
ALIYUN_ASR_MODEL = os.getenv("DASHSCOPE_ASR_MODEL", "qwen3-asr-flash")
ALIYUN_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")

# ===== 小米 Mimo（保留，备用）=====
BASE_URL = os.getenv("MIMO_BASE_URL", "https://token-plan-cn.xiaomimimo.com/v1")
MODEL = os.getenv("MIMO_MODEL", "mimo-v2-omni")
API_KEY = os.getenv("MIMO_API_KEY", "")

# Key 优先取环境变量；否则从 gitignored 的 config_local.py 读取（打包时随之编入二进制）。
try:
    from backend import config_local as _local
except ImportError:
    _local = None

if not ALIYUN_API_KEY and _local is not None:
    ALIYUN_API_KEY = getattr(_local, "ALIYUN_API_KEY", "")
if not API_KEY and _local is not None:
    API_KEY = getattr(_local, "API_KEY", "")
