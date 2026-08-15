# Probe values

**What to type into a field, and why the obvious answer is wrong half the time.**

A probe exists to make the control's behaviour observable. A value that produces an empty result
does not do that: "no options appeared" is indistinguishable from "the autocomplete is broken",
"the request failed", and "this is not actually an autocomplete". The probe completes, the artifact
gains an entry, and nothing was learned.

So the value is derived, not invented.

---

## P1. Split by whether anything can be persisted

This is the distinction that resolves the tension with `00-safety.md` Rule 5, and it maps onto the
same read-only-versus-mutating line the rest of that document draws.

| | **Query inputs** | **Entry inputs** |
|---|---|---|
| Examples | search, filter, autocomplete, type-ahead, quick-find | any field on a form that will be saved |
| Persists anything? | No. The value goes to a query and is discarded | Yes, if submitted |
| Safety engaged? | No | Yes — Rule 5 applies in full |
| Value comes from | **data already visible on the page** | an obviously synthetic value, well-formed |

A query input given a synthetic token searches for something that by construction does not exist.
That is the failure this document is here to prevent, and it is not a safety measure — nothing was
ever going to be written.

## P2. Derivation order

Work down until one applies.

1. **Copy from the page.** If the input filters or searches a collection that is on screen, take an
   exact substring of a value in that collection. This *guarantees* a non-empty result, which is
   what makes the populated state observable: the option list's shape, whether options are
   selectable, whether they carry avatars or secondary lines, and the row count going N → M.
2. **Obey the constraints.** `type`, `pattern`, `min`/`max`, `maxlength`, `step`, `inputmode` and
   `required` all state the expected shape. An email field given `zzprobe` records a validation
   error — and that error is a property of *the value*, not of the field. Synthetic and well-formed
   are not in tension: `zzprobe@example.test` is both.
3. **Read the label.** The label, placeholder, `aria-label` or adjacent text says what kind of thing
   the field holds. A field asking for a person's name gets a person's name; one asking for a city
   gets a city. See P3 for which language.
4. **Fall back to a synthetic token.** `zzprobe` and friends — for a plain free-text field with no
   constraints, no semantics, and nothing to match against. Last, not first.

## P3. Match the script and language of the field's own label

If the label is written in a given script, the value should be too.

This is not politeness. Applications validate names by character class, sort by locale collation,
and split full names on rules that differ by language. Typing Latin text into a field labelled in
Cyrillic can trip a validator, and the probe then records "the field rejects input" as a property
of the field rather than of the mismatched value it was given.

Take the language from the field's own label, not from the browser or the UI chrome — a form can
be localised while the surrounding shell is not. `<html lang>` is the fallback signal.

## P4. An empty result is not a completed probe

If a matching control returns nothing, the probe has not finished:

1. Retry with a value copied from the page per P2.1.
2. If it is still empty, **that is a real finding** — record it concretely in `Observed:` (what was
   typed, what the request returned, what the empty state says) and note it. An app whose search
   cannot find its own visible data is a bug worth reporting, and it is the sort of thing this
   process exists to surface.

What is not acceptable is recording an empty result as though it characterised the control.

## P5. Record where the value came from

`Value-source:` on every input-family element: `page-data`, `constraint`, `label`, or `synthetic`
(`02-artifact-schema.md`). W009 fires when a matching control — search, autocomplete, anything that
filters — records `synthetic`, because that combination cannot have matched anything.

The field exists because the provenance is what makes the observation reproducible. "Typed a name
that was already in the table" and "typed a random token" are different experiments, and only one
of them tells you what the option list looks like when it has contents.

## P6. Cleanup is unchanged

Every value typed is cleared afterwards and the field confirmed empty, exactly as before
(`00-safety.md` Rule 5, `rules/element.md` E6). Copying a value from the page does not change what
happens at the end of the probe — it changes only what the probe is able to see while it runs.

## P7. Note on what lands in the artifact

`analysis.md` is committed to the user's repository, so a value copied from the page is real
application data in version control. For a search term this is usually consistent with what is
already committed — the baseline screenshot shows the same data — but it is worth a moment's
thought on an application handling personal or regulated data, and worth raising with the user
rather than deciding for them. Free-text content — comments, notes, descriptions — is never copied
into the artifact regardless.
