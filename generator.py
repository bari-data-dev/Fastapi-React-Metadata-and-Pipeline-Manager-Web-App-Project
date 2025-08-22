import os

# Struktur folder & file revisi
structure = {
    "backend": {
        ".env": "",
        "requirements.txt": "",
        "main.py": "",
        "app": {
            "__init__.py": "",
            "core": {
                "config.py": "",
                "utils.py": "",
            },
            "db": {
                "__init__.py": "",
                "database.py": "",
            },
            "models": {
                "__init__.py": "",
                "client.py": "",
            },
            "schemas": {
                "__init__.py": "",
                "client.py": "",
            },
            "services": {
                "__init__.py": "",
                "client_service.py": "",
            },
            "routers": {
                "__init__.py": "",
                "client_router.py": "",
            },
            "types.py": "",
        },
    }
}


def create_structure(base_path, struct):
    for name, content in struct.items():
        path = os.path.join(base_path, name)

        if isinstance(content, dict):  # folder
            os.makedirs(path, exist_ok=True)
            create_structure(path, content)
        else:  # file
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)


if __name__ == "__main__":
    create_structure(".", structure)
    print("✅ Struktur folder berhasil dibuat!")
