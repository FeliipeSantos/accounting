"""Registry of the system modules.

Each module is a package under app/modules with a `models` module (its tables,
prefixed with the module name) and, optionally, a `blueprint` (routes) and a
`cli_group` (terminal commands). A new module only needs a folder here and one
entry in MODULES.
"""

from importlib import import_module

from flask import Flask

MODULES = ["projects", "intelligence", "reforma"]


def register_modules(app: Flask) -> None:
    for name in MODULES:
        package = import_module(f"app.modules.{name}")
        import_module(f"app.modules.{name}.models")
        blueprint = getattr(package, "blueprint", None)
        if blueprint is not None:
            app.register_blueprint(blueprint)
        cli_group = getattr(package, "cli_group", None)
        if cli_group is not None:
            app.cli.add_command(cli_group)
