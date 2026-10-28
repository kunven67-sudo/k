"""Checks that compiled classes only call java.*/javax.* APIs that exist on Android minSdk.

Usage: python3 apicheck.py <classes-dir> <api-versions.xml> <minSdk>
"""
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

classes_dir, api_xml, min_sdk = sys.argv[1], sys.argv[2], int(sys.argv[3])

# Parse Android's API database: class -> (since, parents, {member: since})
api = {}
for cls in ET.parse(api_xml).getroot().iter("class"):
    since = int(cls.get("since", "1"))
    parents = [e.get("name") for e in cls if e.tag in ("extends", "implements")]
    members = {}
    for m in cls:
        if m.tag in ("method", "field"):
            members[m.get("name")] = int(m.get("since", str(since)))
    api[cls.get("name")] = (since, parents, members)


def lookup(cls, member, seen=None):
    """Returns the API level a member became available, walking up superclasses/interfaces."""
    seen = seen or set()
    if cls in seen or cls not in api:
        return None
    seen.add(cls)
    since, parents, members = api[cls]
    if member in members:
        return max(since, members[member])
    for p in parents:
        r = lookup(p, member, seen)
        if r is not None:
            return r
    return None


ref = re.compile(r"// (Method|InterfaceMethod|Field) (java/[\w/$]+|javax/[\w/$]+)\.(\"?<?[\w$]+>?\"?):(\S+)")
class_ref = re.compile(r"// class (java/[\w/$]+|javax/[\w/$]+)")
problems, checked = [], 0
files = sorted(str(p) for p in Path(classes_dir).rglob("*.class"))
out = subprocess.run(["javap", "-c", "-p", *files], capture_output=True, text=True).stdout
for line in out.splitlines():
    for kind, owner, name, desc in ref.findall(line):
        name = name.strip('"')
        key = name + (desc if kind != "Field" else "")
        if kind == "Field":
            key = name
        checked += 1
        level = lookup(owner, key)
        if level is None:
            # Field keys in api-versions have no type; method keys include the descriptor.
            problems.append(f"UNKNOWN  {owner}.{key}")
        elif level > min_sdk:
            problems.append(f"API {level:<3} {owner}.{key}")
    for owner in class_ref.findall(line):
        checked += 1
        if owner not in api:
            problems.append(f"UNKNOWN CLASS {owner}")
        elif api[owner][0] > min_sdk:
            problems.append(f"API {api[owner][0]:<3} class {owner}")

problems = sorted(set(problems))
print(f"checked {checked} references in {len(files)} classes")
for p in problems:
    print("  " + p)
sys.exit(1 if problems else 0)
