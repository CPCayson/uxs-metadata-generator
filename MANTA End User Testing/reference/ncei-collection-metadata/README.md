# NCEI collection metadata reference

**Baseline:** Treat **`ncei_template-clean.xml`** (this folder and repo **`NCEI Template/ncei_template-clean.xml`**) as the canonical **NOAA/NCEI-shaped `gmi:MI_Metadata` skeleton** when adjudicating structure for **UxS / mission** work. End-user testing and sample corpora here assume **UxS mission** metadata unless a task explicitly targets another registered profile.

Use this folder when you need to **settle** questions about what “correct” NOAA/NCEI-shaped ISO metadata looks like—during end-user testing, import review, or writer QA—not when guessing from a random catalog export alone. For machine validation beyond the React pilot’s preview sanity checks, use **`xmllint`** (with a local **XML catalog** if XSD chains must resolve offline) or **CoMET** validate when available.

| File | Role |
|------|------|
| **AB-GUID-02823_R1_Guidance for The NCEI Collection Level Metadata Template v1.2.pdf** | Authoritative NCEI guidance for **collection-level** ISO 19115(-2) metadata (template v1.2). Use it to resolve: required conceptual blocks, rubric-oriented expectations, and terminology (collection vs dataset, contacts, distribution). |
| **ncei_template-clean.xml** | A clean **gmi:MI_Metadata** skeleton aligned with that guidance—placeholder tokens like `{{Collection Title}}`, NCEI contact blocks with **gmx:Anchor** (e.g. ROR), standard **metadataStandardName** / **metadataStandardVersion**, citation and identifier patterns. Compare confusing imports side-by-side with this file to see whether gaps are in the **source record** or in **Manta mapping**. |

## How this helps “settle” metadata during testing

1. **Structure disputes** — If an imported sample omits or reshapes a block (e.g. distributor vs pointOfContact), check whether the template still expects that block for collections; then decide if the pilot should map it for **dataset/mission** workflows or document as out-of-scope.
2. **Identifiers & citations** — The XML shows how DOI, accession-style identifiers, and citation titles are expressed in ISO paths; use it as a reference when validating Mission step and Distribution step behavior.
3. **Scope** — This pack is **collection-level**. The mission wizard (`samples/` corpus) is mostly **dataset / acquisition** records. Collections (`EX1904_collection.xml`, etc.) may align better with this reference than a PS2418 UxS file does—that mismatch is expected; use the PDF/XML to set expectations instead of forcing one granule to match a collection template line-for-line.

Mission/dataset work in the React pilot still tracks UxS/NCEI patterns; keep **`samples/`** as the required import test corpus and **`reference/ncei-collection-metadata/`** as the **standard for adjudicating** structure and wording when reviewers disagree.
