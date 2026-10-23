import hashlib
import hmac
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

import db

ROOT = Path(__file__).parent
STATUSES = {"want", "reading", "done"}


@asynccontextmanager
async def lifespan(app):
    db.init_db()
    yield


app = FastAPI(title="読書記録", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")
templates = Jinja2Templates(directory=ROOT / "templates")


class Account(BaseModel):
    name: str
    password: str


class BookIn(BaseModel):
    title: str
    author: str
    status: str
    memo: str = ""


def valid_name(name):
    if len(name) < 1 or len(name) > 32:
        return False
    return all(ch.isprintable() and not ch.isspace() for ch in name)


def valid_password(password):
    return 8 <= len(password) <= 64


def clean_book(body):
    title = body.title.strip()
    author = body.author.strip()
    memo = body.memo.strip()
    if not title or len(title) > 80:
        return None
    if not author or len(author) > 80:
        return None
    if body.status not in STATUSES or len(memo) > 400:
        return None
    return title, author, body.status, memo


def hash_password(password, salt_hex):
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        bytes.fromhex(salt_hex),
        100_000,
    )
    return digest.hex()


def book_json(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "author": row["author"],
        "status": row["status"],
        "memo": row["memo"],
    }


def current_user(request):
    token = request.cookies.get("session")
    if not token:
        return None
    return db.user_from_session(token)


def start_session(response, user_id):
    token = secrets.token_hex(32)
    db.insert_session(token, user_id)
    response.set_cookie(
        "session",
        token,
        httponly=True,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.post("/api/register")
def register(body: Account):
    if not valid_name(body.name) or not valid_password(body.password):
        return JSONResponse({"error": "invalid"}, status_code=400)
    salt = secrets.token_hex(16)
    user_id = db.insert_user(body.name, salt, hash_password(body.password, salt))
    if user_id is None:
        return JSONResponse({"error": "taken"}, status_code=409)
    response = JSONResponse({"name": body.name}, status_code=201)
    start_session(response, user_id)
    return response


@app.post("/api/login")
def login(body: Account):
    if not valid_name(body.name) or not valid_password(body.password):
        return JSONResponse({"error": "invalid"}, status_code=400)
    user = db.get_user_by_name(body.name)
    if user is None:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    digest = hash_password(body.password, user["salt"])
    if not hmac.compare_digest(digest, user["password_hash"]):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    response = JSONResponse({"name": user["name"]})
    start_session(response, user["id"])
    return response


@app.post("/api/logout")
def logout(request: Request):
    token = request.cookies.get("session")
    if token:
        db.delete_session(token)
    response = Response(status_code=204)
    response.delete_cookie("session", path="/")
    return response


@app.get("/api/me")
def me(request: Request):
    user = current_user(request)
    if user is None:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return {"name": user["name"]}


@app.get("/api/books")
def get_books(request: Request):
    user = current_user(request)
    if user is None:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return [book_json(row) for row in db.list_books(user["id"])]


@app.post("/api/books")
def post_book(body: BookIn, request: Request):
    user = current_user(request)
    if user is None:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    cleaned = clean_book(body)
    if cleaned is None:
        return JSONResponse({"error": "invalid"}, status_code=400)
    book_id = db.insert_book(user["id"], *cleaned)
    row = db.get_book(user["id"], book_id)
    return JSONResponse(book_json(row), status_code=201)


@app.put("/api/books/{book_id}")
def put_book(book_id: int, body: BookIn, request: Request):
    user = current_user(request)
    if user is None:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    cleaned = clean_book(body)
    if cleaned is None:
        return JSONResponse({"error": "invalid"}, status_code=400)
    if not db.update_book(user["id"], book_id, *cleaned):
        return JSONResponse({"error": "not_found"}, status_code=404)
    return book_json(db.get_book(user["id"], book_id))


@app.delete("/api/books/{book_id}")
def remove_book(book_id: int, request: Request):
    user = current_user(request)
    if user is None:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    if not db.delete_book(user["id"], book_id):
        return JSONResponse({"error": "not_found"}, status_code=404)
    return Response(status_code=204)
