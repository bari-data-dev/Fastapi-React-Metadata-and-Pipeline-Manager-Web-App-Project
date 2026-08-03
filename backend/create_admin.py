import getpass
import sys

from sqlmodel import Session

from app.db.database import engine
from app.schemas.auth import AppUserCreate
from app.services.auth_service import create_user, get_user_by_username


def main() -> int:
    username = input("Username admin: ").strip().lower()
    full_name = input("Nama lengkap: ").strip()
    password = getpass.getpass("Password (minimal 8 karakter): ")
    confirm = getpass.getpass("Ulangi password: ")

    if password != confirm:
        print("Password tidak sama.")
        return 1
    if len(password) < 8:
        print("Password minimal 8 karakter.")
        return 1

    with Session(engine) as db:
        if get_user_by_username(db, username):
            print("Username sudah ada.")
            return 1
        user = create_user(
            db,
            AppUserCreate(
                username=username,
                password=password,
                full_name=full_name,
                role="ADMIN",
                is_active=True,
            ),
        )
        print(f"Admin berhasil dibuat: {user.username} (ID {user.user_id})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
