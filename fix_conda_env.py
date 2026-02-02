#!/usr/bin/env python3
"""
TermOS: Galactic - Conda Environment Fixer
-----------------------------------------------
Usage:
    python fix_conda_env.py                    (Repair current env)
    python fix_conda_env.py --install pandas   (Install package)
    python fix_conda_env.py --env my_env.yml (Create from YAML)
    python fix_conda_env.py --init py38         (Create new Python 3.8 env)
"""

import sys
import subprocess
import os
import json
from pathlib import Path

# --- CONFIGURATION ---
DEFAULT_ENV_NAME = "termos_galactic"
PYTHON_VERSION = "3.10"

# --- UTILS ---
def run_command(cmd, check=False):
    """Executes a shell command and returns output."""
    try:
        # Use shell=True to access 'conda' if it's in PATH
        result = subprocess.run(
            cmd,
            shell=True,
            check=check,
            capture_output=True,
            text=True
        )
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", f"Execution Error: {e}"

def print_log(msg, type="INFO"):
    """Mimics TermOS Terminal style output."""
    icon = "✅"
    if type == "ERROR": icon = "❌"
    elif type == "WARN": icon = "⚠️"
    elif type == "SYSTEM": icon = "🔧"
    print(f"[{icon}] TERMOS: {msg}")

# --- CORE FUNCTIONS ---

def check_conda():
    """Checks if Conda is installed and accessible."""
    print_log("Checking for Conda installation...", "SYSTEM")
    code, _, _ = run_command("conda --version", check=True)
    
    if code == 0:
        print_log("Conda found successfully.", "INFO")
        return True
    else:
        print_log("Conda not found in PATH. Please install Anaconda/Miniconda.", "ERROR")
        return False

def install_package(package_name, env_name=DEFAULT_ENV_NAME):
    """Installs a specific package into the environment."""
    if not check_conda():
        return False

    print_log(f"Attempting to install '{package_name}' in environment '{env_name}'...", "SYSTEM")
    
    # Command: conda install -n termos_galactic pandas
    cmd = ["conda", "install", "-n", env_name, package_name, "-y"]
    code, stdout, stderr = run_command(cmd)

    if code == 0:
        print_log(f"Successfully installed {package_name}.", "INFO")
    else:
        print_log(f"Failed to install {package_name}.", "ERROR")
        print_log(f"STDERR: {stderr}", "ERROR")

def repair_environment(env_name=DEFAULT_ENV_NAME):
    """
    Attempts to fix a broken environment by:
    1. Uninstalling (if exists).
    2. Re-creating from scratch (or using environment.yml if found).
    3. Re-installing key packages.
    """
    if not check_conda(): return

    # Check if env exists
    code, _, _ = run_command(f"conda env list | grep {env_name}", check=True, shell=True)
    env_exists = (code == 0)

    if env_exists:
        print_log(f"Environment '{env_name}' detected. Attempting repair...", "WARN")
        
        # Strategy: Update base packages to fix dependencies
        cmd = ["conda", "install", "-n", env_name, "--update-all", "-y"]
        code, stdout, stderr = run_command(cmd)
        
        if code == 0:
            print_log(f"Environment '{env_name}' repaired successfully.", "INFO")
        else:
            print_log(f"Repair failed. Check logs manually.", "ERROR")
            print_log(f"STDERR: {stderr}", "ERROR")
    else:
        print_log(f"Environment '{env_name}' does not exist. Creating new one...", "WARN")
        create_environment(env_name, PYTHON_VERSION)

def create_environment_from_yaml(yaml_path):
    """Creates an environment from an environment.yml file."""
    if not os.path.exists(yaml_path):
        print_log(f"File not found: {yaml_path}", "ERROR")
        return

    if not check_conda(): return

    print_log(f"Creating environment from {yaml_path}...", "SYSTEM")
    
    # conda env create -f environment.yml
    cmd = ["conda", "env", "create", "-f", yaml_path]
    code, stdout, stderr = run_command(cmd)

    if code == 0:
        print_log("Environment created successfully.", "INFO")
    else:
        print_log("Environment creation failed.", "ERROR")
        print_log(f"STDERR: {stderr}", "ERROR")

def create_environment(env_name, python_ver):
    """Creates a fresh Conda environment."""
    if not check_conda(): return

    print_log(f"Creating new environment '{env_name}' with Python {python_ver}...", "SYSTEM")
    
    cmd = ["conda", "create", "-n", env_name, f"python={python_ver}", "-y"]
    code, stdout, stderr = run_command(cmd)

    if code == 0:
        print_log(f"Environment '{env_name}' created.", "INFO")
        # Activate it immediately (shell specific)
        activate_script = get_conda_activation_script(env_name)
        print_log(f"To activate, run: {activate_script}", "INFO")
    else:
        print_log("Environment creation failed.", "ERROR")
        print_log(f"STDERR: {stderr}", "ERROR")

def get_conda_activation_script(env_name):
    """Returns the OS-specific command to activate the environment."""
    if sys.platform == "win32":
        return f"conda activate {env_name}"
    else:
        # Linux / macOS
        return f"source ~/miniconda3/bin/activate {env_name} || conda activate {env_name}"

# --- MAIN EXECUTION ---

if __name__ == "__main__":
    if not check_conda():
        sys.exit(1)

    # Parse Arguments
    args = sys.argv[1:]

    if len(args) == 0:
        # Default behavior: Repair the TermOS Galactic environment
        print_log("Running default repair sequence for TermOS...", "SYSTEM")
        repair_environment()
        print_log("Done.", "INFO")
    
    elif "--install" in args:
        # Install specific package: python fix_conda_env.py --install <package>
        try:
            pkg = args[args.index("--install") + 1]
            install_package(pkg)
        except IndexError:
            print_log("Error: No package name specified after --install", "ERROR")

    elif "--env" in args:
        # Create from YAML: python fix_conda_env.py --env environment.yml
        try:
            yaml_path = args[args.index("--env") + 1]
            create_environment_from_yaml(yaml_path)
        except IndexError:
            print_log("Error: No YAML path specified after --env", "ERROR")

    elif "--init" in args:
        # Create new env: python fix_conda_env.py --init python_version
        try:
            py_ver = args[args.index("--init") + 1]
            create_environment(DEFAULT_ENV_NAME, py_ver)
        except IndexError:
            print_log("Error: No python version specified after --init", "ERROR")
    
    else:
        print_log("Unknown command.", "WARN")
        print_log("Usage: python fix_conda_env.py [--install <pkg>] [--env <file.yml>] [--init <py_ver>]", "WARN")
