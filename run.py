import os
import socket
import sys
import threading
import time
import webbrowser

# PyInstaller --windowed（无控制台）下 sys.stdout/stderr 为 None，
# uvicorn 初始化日志格式器会调用 stdout.isatty() 而崩溃。先给它们一个安全占位。
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

import uvicorn  # noqa: E402

from backend.main import app  # noqa: E402


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def main() -> None:
    port = _free_port()
    url = f"http://localhost:{port}/"

    def open_browser() -> None:
        time.sleep(1.2)
        webbrowser.open(url)

    threading.Thread(target=open_browser, daemon=True).start()
    print(f"Speaking Star running at {url}")
    # log_config=None：不走 uvicorn 默认日志配置，彻底避开无控制台时的格式器初始化问题。
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning", log_config=None)


if __name__ == "__main__":
    main()
