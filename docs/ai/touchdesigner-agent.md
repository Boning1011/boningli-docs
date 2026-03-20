---
title: "TouchDesigner Agent: 150 Lines to an AI-Driven GLSL Workflow"
description: A tiny TCP bridge that lets AI coding agents control TouchDesigner — write GLSL shaders, check compile errors, and iterate autonomously. Simple enough to explain in one article, useful enough to run every day.
sidebar_label: TouchDesigner Agent
sidebar_position: 2
tags: [touchdesigner, ai, glsl, python, automation]
---

# TouchDesigner Agent: 150 Lines to an AI-Driven GLSL Workflow

After building [houdini-agent](https://github.com/Boning1011/houdini-agent), I wanted the same thing for TouchDesigner — a way to let a coding agent reach into a running TD instance, write shaders, and self-correct when they don't compile. The result is **[touchdesigner-agent](https://github.com/Boning1011/touchdesigner-agent)**, and it's probably the simplest useful tool I've ever made.

The entire thing is about 150 lines of Python on each side. One file runs inside TD as a TCP command server. The other is a client that any external agent (Claude Code, or anything else that can call Python) uses to talk to it. That's the whole project. And I use it every single day.

## Why This Exists

TouchDesigner is great for real-time visuals, but GLSL iteration in TD is painful. You write a shader, paste it into a DAT, check if it compiled, read the error, fix it, paste again. For a compute shader driving a particle system, you might do that loop fifty times in a session. It's not hard work — it's just slow, repetitive, and interruptible.

The moment I had an agent that could read compile errors and rewrite code on its own, this loop became something I could hand off entirely. I describe the effect I want in natural language, the agent writes the GLSL, pushes it into TD, checks the compile result, and iterates until it works. I watch the viewport.

## The Architecture

The bridge follows the same "thin interface" philosophy as houdini-agent, but even thinner — TD's Python environment is simpler than Houdini's `hou` module, so there's less to wrap.

**TD side** — a TCP/IP DAT in server mode on port 7000, with a Text DAT holding about 60 lines of callback code. It accepts three kinds of commands:

- A raw Python expression → evaluates it in TD, returns the result as JSON
- `exec:<code>` → executes a Python statement (set a parameter, create a node, wire things together)
- `glsl_check:<path>` → refreshes any File In DATs feeding a GLSL node, force-cooks, and returns compile errors

**Agent side** — a `TDClient` class with methods like `query()`, `execute()`, `glsl_check()`, `list_nodes()`, `node_info()`. Each call opens a TCP connection, sends a one-line command, reads a one-line JSON response. No state, no sessions, no dependencies beyond the standard library.

```python
from bridge.client import TDClient

td = TDClient()  # connects to localhost:7000
td.query("op('/project1/glsl1').type")       # → 'glsl'
td.list_nodes("/project1")                    # → ['glsl1', 'noise1', ...]

result = td.glsl_check("/project1/glsl1")
print(result["ok"])      # True / False
print(result["errors"])  # compile error string if any
```

That's it. There's no authentication, no REST framework, no WebSocket upgrade. TCP, newlines, JSON. It works.

## File-Based GLSL Workflow

One thing I got right early: **all shader code lives as local `.glsl` files, not inside TD DATs.**

The `setup_shader()` helper does three things in one call:

1. Creates a `.glsl` file in a `shaders/` folder inside your TD project directory
2. Creates a Text DAT in TD pointing to that file
3. Enables sync mode — TD auto-reloads whenever the file changes on disk

```python
td.setup_shader('particle_compute',
                project_dir='C:/Projects/my_td_project',
                initial_code=glsl_code)
```

After setup, editing is just writing to a file. The agent writes new GLSL to disk, TD picks it up automatically, and a `glsl_check()` call confirms whether it compiled. No clipboard, no DAT manipulation, no manual refresh.

This also means everything stays in Git. The shader files live alongside the `.toe` file in the project repo. Any tool — another AI, a text editor, a colleague — can edit them without opening TD.

## The Self-Debugging Loop

The real payoff is the closed loop: **write → compile check → read errors → fix → repeat.** The agent does this autonomously.

When a GLSL POP shader fails to compile, TD returns errors like `undeclared identifier 'P'` or `type mismatch: vec4 vs vec3`. These are specific enough for the agent to diagnose and fix without human input. A typical interaction looks like:

1. I say: "Make the particles orbit in a spiral pattern with color based on age"
2. The agent writes a compute shader, pushes it to TD
3. TD reports: `undeclared identifier 'P'` — the output attribute wasn't enabled
4. The agent runs `td.execute("op(path).par.outputattrs = 'P'")`  and retries
5. TD reports success. Particles are spiraling in the viewport.

Steps 3–5 happen without me doing anything. The agent already knows about this gotcha because it's documented in its context.

## Same Philosophy, Different DCC

If you've read my piece on [houdini-agent's design philosophy](/ai/houdini-agent-design-philosophy), the pattern should look familiar. The bridge is thin. The agent writes native code (GLSL + TD Python) rather than calling pre-built abstractions. The knowledge lives in plain text, not in the tool's code. The tool gets better by being used, because usage generates documentation.

The difference is that touchdesigner-agent is dramatically simpler — because it needs to be. TD's GLSL workflow has a tighter scope than Houdini's general-purpose proceduralism. The bridge only needs to do three things: send commands, check compile errors, and manage shader files. So that's all it does.

Sometimes the right amount of engineering is barely any at all.
