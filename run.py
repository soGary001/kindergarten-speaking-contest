import socket
import threading
import time
import webbrowser

import uvicorn

from backend.main import app


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
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
