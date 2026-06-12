#!/usr/bin/env python3
"""
Generate audience-lens variants of praneelbhatia.com from index.html.
Single source of truth: edit index.html, then run  python3 build_variants.py
Outputs: robotics.html (robotics.praneelbhatia.com), agents.html (agents.praneelbhatia.com)
"""
import re

SRC = "instrument.html"

GENERAL_SUBLINE = "T-shaped: breadth across embodied AI, agentic development, and enterprise XR; depth into whichever one the problem demands. Drawn to greenfield projects and cold-starts into new tools. The proof: a robot arm that corrects itself mid-task from a person's brain signals, with no retraining."
GENERAL_CRED = "NAT 2026 FIRST AUTHOR &middot; 4 PUBLICATIONS &middot; 2 PATENT FILINGS &middot; B.SC. MECHATRONICS (1.7)"
GENERAL_TITLE = "Praneel Bhatia &middot; Lead Applied AI Engineer &middot; BCI, Robotics, LLM Systems"

VARIANTS = {
    "robotics.html": {
        "title": "Praneel Bhatia &middot; Robotics &amp; Embodied AI Engineer",
        "desc": "Lead Applied AI Engineer at ZanderLabs, Berlin. Robot learning from Isaac Sim to real hardware: VLA policies fine-tuned on real-robot data, world-model grounding, and closed-loop neural feedback at 15 Hz. First-author at NAT 2026.",
        "og_url": "https://robotics.praneelbhatia.com/",
        "mark_sub": "INSTRUMENT&nbsp;v2.7&nbsp;&middot;&nbsp;ROBOTICS",
        "subline": "I take robot policies from simulation to real hardware and wire human brain signals into the control loop. VLA fine-tuning on real-robot data, world-model grounding with Cosmos-Reason1, and correction mid-execution with no retraining.",
        "cred": "NAT 2026 FIRST AUTHOR &middot; SIM-TO-REAL &middot; LEROBOT SO-101 &middot; B.SC. MECHATRONICS (1.7)",
        "cs_order": ["cs-robotics", "cs-linkedchat", "cs-xr", "cs-socialtree", "cs-redactable"],
        "caps_order": [2, 0, 1, 3],
    },
    "agents.html": {
        "title": "Praneel Bhatia &middot; AI Engineer &middot; Agents, Evals &amp; LLM Systems",
        "desc": "Lead Applied AI Engineer at ZanderLabs, Berlin. Agentic engineering with evals gated in CI, MCP servers and sub-agents, realtime voice, and guardrails shipped as open source. The flagship: a robot corrected by brain signals mid-task.",
        "og_url": "https://agents.praneelbhatia.com/",
        "mark_sub": "INSTRUMENT&nbsp;v2.7&nbsp;&middot;&nbsp;AGENTS",
        "subline": "I build agentic systems with production discipline: an agent harness with evals gated in CI, context engineering, MCP everywhere. The flagship is a robot arm that corrects itself mid-task from a person's brain signals, with no retraining.",
        "cred": "OPEN-SOURCE PII REDACTION &middot; MCP SERVERS &middot; EVALS IN CI &middot; NAT 2026 FIRST AUTHOR",
        "cs_order": ["cs-robotics", "cs-redactable", "cs-linkedchat", "cs-socialtree", "cs-xr"],
        "caps_order": [0, 1, 3, 2],
    },
}

ARTICLE_RE = re.compile(r"( *<!-- CS\d[^\n]*-->\n *<article class=\"channel reveal\" id=\"(cs-[a-z]+)\".*?</article>)", re.S)
CAP_RE = re.compile(r"( *<div class=\"cap reveal\">.*?</ul>\n *</div>)", re.S)


def build(src_html, cfg):
    out = src_html

    # head metadata
    out = out.replace(f"<title>{GENERAL_TITLE}</title>".replace("&middot;", "·"),
                      f"<title>{cfg['title']}</title>".replace("&middot;", "·").replace("&amp;", "&"))
    out = re.sub(r'(<meta name="description" content=")[^"]*(">)', r"\g<1>" + cfg["desc"] + r"\g<2>", out)
    out = re.sub(r'(<meta property="og:description" content=")[^"]*(">)', r"\g<1>" + cfg["desc"] + r"\g<2>", out)
    out = re.sub(r'(<meta property="og:url" content=")[^"]*(">)', r"\g<1>" + cfg["og_url"] + r"\g<2>", out)
    out = out.replace("</title>\n", "</title>\n<link rel=\"canonical\" href=\"" + cfg["og_url"] + "\">\n", 1)

    # nav lens tag
    out = out.replace('<span class="mark-sub">INSTRUMENT&nbsp;v2.7</span>',
                      f'<span class="mark-sub">{cfg["mark_sub"]}</span>')

    # hero subline + credential strip
    out = out.replace(GENERAL_SUBLINE, cfg["subline"])
    out = out.replace(GENERAL_CRED, cfg["cred"])

    # reorder case-study channels
    blocks = ARTICLE_RE.findall(out)
    by_id = {bid: block for block, bid in blocks}
    assert len(by_id) == len(cfg["cs_order"]), f"expected {len(cfg['cs_order'])} articles, found {len(by_id)}"
    original_seq = "\n\n".join(b for b, _ in blocks)
    joined = "\n\n".join(by_id[i] for i in cfg["cs_order"])
    first_block = blocks[0][0]
    start = out.index(first_block)
    last_block = blocks[-1][0]
    end = out.index(last_block) + len(last_block)
    out = out[:start] + joined + out[end:]

    # reorder capability columns
    caps = CAP_RE.findall(out)
    assert len(caps) == 4, f"expected 4 capability columns, found {len(caps)}"
    cstart = out.index(caps[0])
    cend = out.index(caps[-1]) + len(caps[-1])
    out = out[:cstart] + "\n".join(caps[i] for i in cfg["caps_order"]) + out[cend:]

    return out


def main():
    src = open(SRC, encoding="utf-8").read()
    for fname, cfg in VARIANTS.items():
        open(fname, "w", encoding="utf-8").write(build(src, cfg))
        print(f"built {fname}")


if __name__ == "__main__":
    main()
