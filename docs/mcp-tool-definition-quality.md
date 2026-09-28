# We ran Glama's open tool-definition rubric against our own MCP server. Here is the part that needs no judge.

Measured 2026-09-28 by `tools/audit-tool-definition-quality.mjs`. The inputs are exactly what a client receives from `tools/list` on the
credential-free local runtime - 15 tools over 1 page(s), cursor exhausted: `true`.
No provider was called and no credential was read.

## What this is, and the one thing it is not

[Glama's Tool Definition Quality Score](https://github.com/glama-ai/tool-definition-quality-score) is an open
specification: four stages, of which three are deterministic code and one - stage 3 - is an LLM rubric call.
This page reports the deterministic stages, applied to our own server, which is the part a maintainer can
verify without a judge. **It is not a TDQS score and does not predict one.** The graded dimensions
(purpose clarity, usage guidelines, conciseness) need the evaluator, and Glama's own grade for us is a
separate thing reported below.

## The checklist, scored against our rows

| what the rubric asks for | ours | the spec says |
| --- | --- | --- |
| a description that exists | 15/15 (100%) | "the primary scoring target" |
| an MCP display title | 15/15 | optional |
| all four MCP annotations declared | 15/15 (100%) | item 3: they "lower the disclosure burden on your description" |
| every parameter documented | 20/20 | item 4: per-property descriptions "raise your baseline to 3 on its own" |
| a documented output schema | 0/15 | item 5: "a bare `{"type": "object"}` earns nothing" |
| a description naming a sibling tool | 0/15 | item 1: say how this tool differs from its neighbours |
| any when/if phrasing (proxy, see below) | 5/15 | item 2: "say when (and when not) to use it" |
| an ordering smell ("always call this first") | 0/15 | a tool-set problem, not a description problem |

Where the set is strong: 15/15 carry a display title, 15/15 declare all
four MCP annotations, and 20/20 input properties carry a description -
item 4 met in full. Where it is thin: **15 of 15 tools declare no `outputSchema`**, so
the description has to carry the return-value explanation instead, and 8 of the 15 descriptions
run under 90 characters - so most of them carry neither.

## The row that is a proxy, said plainly

`mentions_when_to_use` is a regex over `\b(when|if you|use this|for )\b`. It is not the graded "Usage
Guidelines" dimension and it cannot tell a real boundary from a sentence that happens to contain "for".
It is reported because it is cheap and because the rubric weights the thing it approximates. Read it as
5 of 15 descriptions contain at least one word the rubric's own example sentences use, and nothing more.

## Where a judge would look hardest: the health cluster

Grouping our tool names by their last segment puts 3 of the 15 in one family:

| tool | description chars | input properties | names a sibling |
| --- | --- | --- | --- |
| `gateway_health` | 73 | 0 | none |
| `workflow_health` | 68 | 0 | none |
| `workforce_health` | 67 | 0 | none |

Those 3 tools answer structurally similar questions and, across all of their
descriptions, they make 0 references to each other by name. The rubric is specific about why
this matters: "a description is only clear if it lets an agent distinguish this tool from its
neighbors", and naming a sibling to mark a boundary "still earns full marks on Usage Guidelines".
It also gives the counter-example we do not have: 0 of our descriptions say anything
like "always call this first", which the spec treats as a tool-set defect dressed up as prose.

## What Glama itself reports about us

Our public Glama card renders `license` and `maintenance` as grades and `quality` as
`Not graded` - read off the served badge on 2026-09-28, not from a PR comment. That is the state of the
one requirement blocking our submission to the largest MCP list, and it is worth being exact about
what this page can and cannot do about it: nothing here triggers Glama's evaluation, and a stronger
definition set is not the same thing as a scanned one. The audit exists because the rubric is the
best available description of what an agent sees when it meets our server, which is a reason to run it
independent of any badge.

## What this does not support

- That we would score well, or badly, on TDQS. Stage 3 is an LLM call we did not make.
- That `tools/list` is the whole client experience: results, errors and streaming behaviour are unscored here.
- That the 9 zero-parameter tools are thinner than the rest; a health check with no inputs is a
  reasonable shape, and this page does not rank them.
- That any other server was measured. This is one server, our own, on one day.

## Reproduce

```bash
node tools/audit-tool-definition-quality.mjs /tmp/tdqs.json --expect-count 15
node tools/render-tdqs-self-audit-doc.mjs --artifact /tmp/tdqs.json --out /tmp/article.md
```

The instrument boots the real server in-process on the local runtime, so it needs no credentials and no
network. It refuses rather than reporting: on a blank endpoint, on a `tools/list` result whose field path
it cannot read, on a duplicate or missing name, and when the served count disagrees with the count this
repository publishes. `--tamper-blind` makes the first of those fire on purpose.

---

*Instrument output: [`data/mcp-tool-definition-quality.2026-09-28.json`](data/mcp-tool-definition-quality.2026-09-28.json).*

Generated from the artifact by `tools/render-tdqs-self-audit-doc.mjs`; the renderer recomputes every
number above from the rows and refuses if an aggregate disagrees with the data it sums.
