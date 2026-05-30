from __future__ import annotations

import json
import mimetypes
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
DATA_DIR = ROOT / "data"
DATA_FILE = DATA_DIR / "orders.json"
HISTORY_FILE = DATA_DIR / "history.json"
SYSTEM_FILE = DATA_DIR / "system.json"
DATABASE_FILE = DATA_DIR / "database.json"
HOST = "0.0.0.0"
PORT = 3000


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_orders() -> list[dict]:
    try:
        if DATA_FILE.exists():
            content = DATA_FILE.read_text(encoding="utf-8")
            parsed = json.loads(content)
            if isinstance(parsed, list):
                return parsed
    except Exception as error:  # noqa: BLE001
        print(f"Falha ao carregar pedidos: {error}")
    return []


def load_history() -> list[dict]:
    try:
        if HISTORY_FILE.exists():
            content = HISTORY_FILE.read_text(encoding="utf-8")
            parsed = json.loads(content)
            if isinstance(parsed, list):
                return parsed
    except Exception as error:  # noqa: BLE001
        print(f"Falha ao carregar histórico: {error}")
    return []


def load_database() -> list[dict]:
    try:
        if DATABASE_FILE.exists():
            content = DATABASE_FILE.read_text(encoding="utf-8")
            parsed = json.loads(content)
            if isinstance(parsed, list):
                return parsed
    except Exception as error:  # noqa: BLE001
        print(f"Falha ao carregar banco de dados: {error}")
    return []


def load_system_settings() -> dict:
    try:
        if SYSTEM_FILE.exists():
            content = SYSTEM_FILE.read_text(encoding="utf-8")
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                return parsed
    except Exception as error:  # noqa: BLE001
        print(f"Falha ao carregar configurações do sistema: {error}")
    return {"openingDate": "", "closingDate": "", "snackPrice": "0", "closingSummary": None}


def ensure_system_defaults(settings: dict) -> dict:
    defaults = {
        "openingDate": "",
        "closingDate": "",
        "snackPrice": "0",
        "closingSummary": None,
    }
    merged = {**defaults, **settings}
    return merged


orders: list[dict] = load_orders()
history: list[dict] = load_history()
database: list[dict] = load_database()
system_settings: dict = ensure_system_defaults(load_system_settings())


def save_orders() -> None:
    ensure_data_dir()
    DATA_FILE.write_text(json.dumps(orders, ensure_ascii=False, indent=2), encoding="utf-8")


def save_history() -> None:
    ensure_data_dir()
    HISTORY_FILE.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")


def save_system_settings() -> None:
    ensure_data_dir()
    SYSTEM_FILE.write_text(json.dumps(system_settings, ensure_ascii=False, indent=2), encoding="utf-8")


def save_database() -> None:
    ensure_data_dir()
    DATABASE_FILE.write_text(json.dumps(database, ensure_ascii=False, indent=2), encoding="utf-8")


def normalize_code(value: object) -> str:
    return str(value or "").strip()


def normalize_status(value: object) -> str:
    return str(value or "").strip()


def normalize_price(value: object) -> str:
    text = str(value or "").strip().replace("R$", "").replace(" ", "").replace(",", ".")
    if not text:
        return "0"

    try:
        price = Decimal(text)
    except InvalidOperation as error:
        raise ValueError("Informe um valor válido para o lanche.") from error

    if price < 0:
        raise ValueError("O valor do lanche não pode ser negativo.")

    return str(price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def parse_iso_datetime(value: str) -> datetime:
    text = str(value or "").strip()
    if not text:
        raise ValueError("Data inválida.")

    normalized = text.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def collect_day_orders(opening_date: str, closing_date: str) -> list[dict]:
    start = parse_iso_datetime(opening_date)
    end = parse_iso_datetime(closing_date)
    combined = [*orders, *history]
    unique_orders: dict[tuple[str, str], dict] = {}

    for item in combined:
      code = normalize_code(item.get("code"))
      created_at = str(item.get("createdAt") or "").strip()
      if not code or not created_at:
          continue

      try:
          created = parse_iso_datetime(created_at)
      except ValueError:
          continue

      if start <= created <= end:
          unique_orders[(code, created_at)] = item

    return list(unique_orders.values())


def build_closing_summary(closing_date: str | None = None) -> dict:
    opening_date = normalize_code(system_settings.get("openingDate"))
    if not opening_date:
        raise ValueError("Informe a data de abertura antes de encerrar o dia.")

    closing_value = normalize_code(closing_date) or datetime.now(timezone.utc).isoformat()
    snack_price = Decimal(normalize_price(system_settings.get("snackPrice")))
    day_orders = collect_day_orders(opening_date, closing_value)
    total_orders = len(day_orders)
    total_received = (snack_price * Decimal(total_orders)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return {
        "openingDate": opening_date,
        "closingDate": closing_value,
        "snackPrice": str(snack_price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "ordersCount": total_orders,
        "receivedValue": str(total_received),
        "calculatedAt": datetime.now(timezone.utc).isoformat(),
    }


def update_order(code: object, status: object) -> dict:
    order_code = normalize_code(code)
    order_status = normalize_status(status)

    if not order_code:
        raise ValueError("Informe o número da comanda.")
    if not order_status:
        raise ValueError("Informe o status.")

    now = datetime.now(timezone.utc).isoformat()
    existing_index = next((index for index, item in enumerate(orders) if item.get("code") == order_code), None)

    if existing_index is None:
        orders.insert(
            0,
            {
                "code": order_code,
                "status": order_status,
                "createdAt": now,
                "updatedAt": now,
            },
        )
        result = orders[0]
    else:
        orders[existing_index].update({"status": order_status, "updatedAt": now})
        result = orders[existing_index]

    save_orders()
    return result


def finalize_order(code: object) -> dict:
    order_code = normalize_code(code)

    if not order_code:
        raise ValueError("Informe o número da comanda.")

    now = datetime.now(timezone.utc).isoformat()
    existing_index = next((index for index, item in enumerate(orders) if item.get("code") == order_code), None)

    if existing_index is None:
        raise ValueError("Comanda não encontrada ou já foi finalizada.")

    order_status = normalize_status(orders[existing_index].get("status"))
    if not order_status or order_status.lower() == "finalizado":
        raise ValueError("Apenas comandas em aberto podem ser finalizadas.")

    result = orders.pop(existing_index)
    result = {**result, "status": "Finalizado", "updatedAt": now}

    finalized_item = {**result, "finalizedAt": now}
    history.insert(0, finalized_item)
    database.insert(0, finalized_item)
    save_orders()
    save_history()
    save_database()
    return result


def delete_order(code: object) -> bool:
    order_code = normalize_code(code)
    initial_length = len(orders)
    orders[:] = [item for item in orders if item.get("code") != order_code]

    if len(orders) != initial_length:
        save_orders()
        return True
    return False


def delete_history_item(code: object) -> bool:
    order_code = normalize_code(code)
    initial_length = len(history)
    history[:] = [item for item in history if item.get("code") != order_code]

    if len(history) != initial_length:
        save_history()
        return True
    return False


def set_opening_date(opening_date: object) -> dict:
    value = normalize_code(opening_date)

    if not value:
        raise ValueError("Informe a data de abertura do sistema.")

    global history
    history.clear()
    save_history()
    system_settings["openingDate"] = value
    system_settings["updatedAt"] = datetime.now(timezone.utc).isoformat()
    system_settings["closingDate"] = ""
    system_settings["snackPrice"] = "0"
    system_settings["closingSummary"] = None
    save_system_settings()
    return system_settings


def set_closing_date(closing_date: object) -> dict:
    summary = build_closing_summary(normalize_code(closing_date))
    system_settings["closingDate"] = summary["closingDate"]
    system_settings["closingSummary"] = summary
    system_settings["updatedAt"] = summary["calculatedAt"]
    save_system_settings()
    return system_settings


def clear_system() -> dict:
    """Limpa dados da sessão do dia: abre novo dia com histórico em branco."""
    global history
    history.clear()
    save_history()
    system_settings["openingDate"] = ""
    system_settings["closingDate"] = ""
    system_settings["snackPrice"] = "0"
    system_settings["closingSummary"] = None
    system_settings["updatedAt"] = datetime.now(timezone.utc).isoformat()
    save_system_settings()
    return system_settings


def export_history_csv() -> str:
    """Exporta histórico do banco de dados como CSV."""
    csv_lines = ["código,data_criação,data_finalização,status"]
    for item in database:
        code = item.get("code", "")
        created_at = item.get("createdAt", "")
        finalized_at = item.get("finalizedAt", "")
        status = item.get("status", "")
        csv_lines.append(f"{code},{created_at},{finalized_at},{status}")
    return "\n".join(csv_lines)


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "FestaJuninaHTTP/1.0"

    def _send_json(self, payload: object, status: int = 200) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _send_file(self, file_path: Path) -> None:
        if not file_path.exists() or not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "Arquivo não encontrado")
            return

        content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        data = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        route = parsed.path

        if route == "/api/orders":
            self._send_json({"orders": orders})
            return

        if route == "/api/history":
            self._send_json({"history": history})
            return

        if route == "/api/history/export":
            csv_content = export_history_csv()
            csv_data = csv_content.encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="historico.csv"')
            self.send_header("Content-Length", str(len(csv_data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(csv_data)
            return

        if route == "/api/system":
            self._send_json({"system": system_settings})
            return

        if route in {"/", "/index.html"}:
            self._send_file(PUBLIC_DIR / "index.html")
            return

        if route == "/painel":
            self._send_file(PUBLIC_DIR / "painel.html")
            return

        if route == "/operacao":
            self._send_file(PUBLIC_DIR / "operacao.html")
            return

        if route == "/historico":
            self._send_file(PUBLIC_DIR / "historico.html")
            return

        if route.startswith("/public/"):
            self._send_file(ROOT / route.lstrip("/"))
            return

        asset = PUBLIC_DIR / route.lstrip("/")
        if asset.exists() and asset.is_file():
            self._send_file(asset)
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Rota não encontrada")

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        route = parsed.path

        try:
            if route == "/api/system":
                body = self._read_json_body()
                system = system_settings
                if body.get("clear") is True:
                    system = clear_system()
                elif body.get("openingDate") is not None:
                    system = set_opening_date(body.get("openingDate"))
                if body.get("closingDate") is not None:
                    system = set_closing_date(body.get("closingDate"))
                self._send_json({"system": system})
                return

            if route == "/api/orders":
                body = self._read_json_body()
                order = update_order(body.get("code"), body.get("status"))
                self._send_json({"order": order, "orders": orders}, status=HTTPStatus.CREATED)
                return

            if route.startswith("/api/orders/") and route.endswith("/finalize"):
                code = route.removeprefix("/api/orders/").removesuffix("/finalize").strip("/")
                order = finalize_order(code)
                self._send_json({"order": order, "orders": orders})
                return

            self.send_error(HTTPStatus.NOT_FOUND, "Rota não encontrada")
        except ValueError as error:
            self._send_json({"error": str(error)}, status=HTTPStatus.BAD_REQUEST)
        except json.JSONDecodeError:
            self._send_json({"error": "JSON inválido."}, status=HTTPStatus.BAD_REQUEST)

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        route = parsed.path

        if route.startswith("/api/orders/"):
            code = route.removeprefix("/api/orders/").strip("/")
            if delete_order(code):
                self.send_response(HTTPStatus.NO_CONTENT)
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return
            self._send_json({"error": "Comanda não encontrada."}, status=HTTPStatus.NOT_FOUND)
            return

        if route.startswith("/api/history/"):
            code = route.removeprefix("/api/history/").strip("/")
            if delete_history_item(code):
                self.send_response(HTTPStatus.NO_CONTENT)
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return
            self._send_json({"error": "Comanda não encontrada no histórico."}, status=HTTPStatus.NOT_FOUND)
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Rota não encontrada")

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        print(f"{self.address_string()} - {format % args}")


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), RequestHandler)
    print(f"Servidor rodando em http://{HOST}:{PORT}")
    print(f"Painel do monitor em http://localhost:{PORT}/painel")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Encerrando servidor...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()