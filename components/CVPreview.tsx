import type { CvData } from "@/lib/cv-data";

/**
 * Read-only, on-screen rendering of an assembled CV — no input fields, no
 * contentEditable. Physical mm/pt Tailwind arbitrary values mirror
 * components/CVDocument.tsx (the PDF) and lib/tokens.ts 1:1, so what's shown
 * here is the same size and typography as the exported PDF, not just a
 * similar-looking approximation. Tailwind's JIT compiler needs literal
 * static class strings, so these mm/pt numbers are hand-copied from
 * lib/tokens.ts rather than imported — see DOCS.md §6 for the pairing rule:
 * change a value in tokens.ts, update the matching literal here too.
 */

const SKILLS_SEPARATOR = "   •   ";

export function CVPreview({ data }: { data: CvData }) {
  return (
    <div className="w-[210mm] min-h-[297mm] bg-white p-[18mm] text-[10pt] leading-[1.2] text-cv-body shadow-md">
      <div className="flex items-start">
        {data.photoUrl ? (
          // Physical CV photo, not decorative — but there's no caption text to use as alt.
          // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
          <img src={data.photoUrl} className="h-[24mm] w-[24mm] object-cover" />
        ) : null}
        <div className="ml-[6mm] flex-1">
          <p className="text-[22pt] font-bold text-cv-navy">{data.name.toUpperCase()}</p>
          {data.title ? <p className="mt-1 text-[12.5pt] text-cv-amber">{data.title}</p> : null}
          <p className="mt-1 text-[9.5pt] text-cv-grey-dark">
            {[data.contact.email, data.contact.phone, data.contact.location, data.contact.website]
              .filter(Boolean)
              .join("  |  ")}
          </p>
        </div>
      </div>

      <div className="mt-[3mm] mb-[4mm] border-b-[1.2pt] border-cv-amber" />

      {data.summary ? (
        <section>
          <h2 className="mb-[1mm] text-[12pt] font-bold text-cv-navy">PROFESSIONAL SUMMARY</h2>
          <p className="text-[10pt] leading-[1.2] text-cv-body">{data.summary}</p>
        </section>
      ) : null}

      {data.experience.length > 0 ? (
        <section className="mt-[1mm]">
          <h2 className="mb-[1mm] text-[12pt] font-bold text-cv-navy">PROFESSIONAL EXPERIENCE</h2>
          <div className="flex flex-col">
            {data.experience.map((entry, i) => (
              <div key={entry.id} className={i === 0 ? "" : "mt-[1.2mm]"}>
                <p className="text-[11pt] font-bold text-cv-navy">{entry.title}</p>
                <p className="mt-px text-[10pt] text-cv-amber italic">
                  {[entry.company, entry.dates].filter(Boolean).join("  |  ")}
                </p>
                <ul className="flex flex-col">
                  {entry.bullets.map((bullet, bi) => (
                    <li key={bi} className="mt-[0.5mm] flex">
                      <span className="w-[4mm] shrink-0 text-[10pt] text-cv-body">•</span>
                      <span className="flex-1 text-[10pt] leading-[1.2] text-cv-body">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data.education.length > 0 ? (
        <section className="mt-[1mm]">
          <h2 className="mb-[1mm] text-[12pt] font-bold text-cv-navy">EDUCATION</h2>
          <div className="flex flex-col">
            {data.education.map((entry, i) => (
              <div key={entry.id} className={i === 0 ? "" : "mt-[1.2mm]"}>
                <p className="text-[11pt] font-bold text-cv-navy">{entry.degree}</p>
                <p className="mt-px text-[10pt] text-cv-grey-dark">
                  {[entry.school, entry.endDate].filter(Boolean).join(" — ")}
                  {entry.honors ? ` (${entry.honors})` : ""}
                </p>
                {entry.description ? (
                  <p className="mt-px text-[10pt] leading-[1.2] text-cv-body">{entry.description}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data.skills.length > 0 ? (
        <section className="mt-[1mm]">
          <h2 className="mb-[1mm] text-[12pt] font-bold text-cv-navy">SKILLS</h2>
          <p className="text-[10pt] leading-[1.2] text-cv-body">{data.skills.join(SKILLS_SEPARATOR)}</p>
        </section>
      ) : null}

      {data.languages.length > 0 ? (
        <section className="mt-[1mm]">
          <h2 className="mb-[1mm] text-[12pt] font-bold text-cv-navy">LANGUAGES</h2>
          <div className="flex flex-wrap">
            {data.languages.map((lang, i) => (
              <p key={lang.lang} className="text-[10pt] text-cv-body">
                <span className="font-bold">{lang.lang}</span>
                {` (${lang.level})`}
                {i < data.languages.length - 1 ? <span className="mx-[6pt] text-cv-grey-light">—</span> : null}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
