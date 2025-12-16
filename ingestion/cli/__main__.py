# @fileoverview CLI entry point
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Entry point for CLI module

from ingestion.cli.commands import cli

if __name__ == "__main__":
    cli()

