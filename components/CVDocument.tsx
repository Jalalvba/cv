import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "@/lib/cv-data";
import { COLORS, FONT_SIZE, SPACING_MM, PAGE, PHOTO_SIZE_MM, DIVIDER_THICKNESS_PT, LINE_HEIGHT, mmToPt } from "@/lib/tokens";

/**
 * The @react-pdf/renderer PDF document — server-rendered by
 * app/api/export-pdf/route.ts. Built from the same lib/tokens.ts numbers as
 * components/CVPreview.tsx (the web view), so the two stay pixel-identical
 * at `scale={1}` (the default).
 *
 * `scale` multiplies every font size, internal spacing gap, the photo size,
 * and the divider thickness by a single factor — everything except the page
 * margin (lib/tokens.ts's PAGE.marginMm), which stays fixed. It exists
 * because a one-A4-page PDF is a hard requirement (see DOCS.md §6): the
 * export route renders at scale 1, checks the resulting page count, and
 * re-renders at a smaller scale if it overflowed — see
 * app/api/export-pdf/route.ts's fitToOnePage(). Below scale 1, this PDF is
 * no longer pixel-identical to CVPreview.tsx (which always renders at a
 * fixed size, on-screen — it never paginates, so it has nothing to shrink
 * to fit) — a disclosed trade-off, since fitting one page takes priority.
 */

function createStyles(scale: number) {
  const mm = (valueMm: number) => mmToPt(valueMm * scale);
  const pt = (valuePt: number) => valuePt * scale;

  return StyleSheet.create({
    page: {
      paddingTop: mmToPt(PAGE.marginMm),
      paddingBottom: mmToPt(PAGE.marginMm),
      paddingLeft: mmToPt(PAGE.marginMm),
      paddingRight: mmToPt(PAGE.marginMm),
      fontFamily: "Helvetica",
      fontSize: pt(FONT_SIZE.body),
      color: COLORS.body,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    photo: {
      width: mm(PHOTO_SIZE_MM),
      height: mm(PHOTO_SIZE_MM),
      objectFit: "cover",
    },
    headerText: {
      marginLeft: mm(SPACING_MM.photoGap),
      flex: 1,
      justifyContent: "center",
    },
    name: {
      fontFamily: "Helvetica-Bold",
      fontSize: pt(FONT_SIZE.name),
      color: COLORS.navy,
    },
    title: {
      fontFamily: "Helvetica",
      fontSize: pt(FONT_SIZE.title),
      color: COLORS.amber,
      marginTop: pt(4),
    },
    contact: {
      fontFamily: "Helvetica",
      fontSize: pt(FONT_SIZE.contact),
      color: COLORS.greyDark,
      marginTop: pt(4),
    },
    divider: {
      borderBottomWidth: pt(DIVIDER_THICKNESS_PT),
      borderBottomColor: COLORS.amber,
      marginTop: mm(SPACING_MM.dividerMarginTop),
      marginBottom: mm(SPACING_MM.dividerMarginBottom),
    },
    section: {
      marginTop: mm(SPACING_MM.sectionGapTop),
    },
    sectionFirst: {
      marginTop: 0,
    },
    sectionHeader: {
      fontFamily: "Helvetica-Bold",
      fontSize: pt(FONT_SIZE.sectionHeader),
      color: COLORS.navy,
      marginBottom: mm(SPACING_MM.sectionHeaderGapBottom),
    },
    paragraph: {
      fontFamily: "Helvetica",
      fontSize: pt(FONT_SIZE.body),
      color: COLORS.body,
      lineHeight: LINE_HEIGHT,
    },
    entry: {
      marginTop: mm(SPACING_MM.entryGapTop),
    },
    entryFirst: {
      marginTop: 0,
    },
    roleTitle: {
      fontFamily: "Helvetica-Bold",
      fontSize: pt(FONT_SIZE.roleTitle),
      color: COLORS.navy,
    },
    companyLine: {
      fontFamily: "Helvetica-Oblique",
      fontSize: pt(FONT_SIZE.companyLine),
      color: COLORS.amber,
      marginTop: pt(1),
    },
    bulletRow: {
      flexDirection: "row",
      marginTop: mm(SPACING_MM.bulletGap),
      paddingLeft: mm(4),
    },
    bulletMarker: {
      width: mm(4),
      fontSize: pt(FONT_SIZE.body),
      color: COLORS.body,
    },
    bulletText: {
      flex: 1,
      fontFamily: "Helvetica",
      fontSize: pt(FONT_SIZE.body),
      color: COLORS.body,
      lineHeight: LINE_HEIGHT,
    },
    degree: {
      fontFamily: "Helvetica-Bold",
      fontSize: pt(FONT_SIZE.degree),
      color: COLORS.navy,
    },
    institutionLine: {
      fontFamily: "Helvetica",
      fontSize: pt(FONT_SIZE.body),
      color: COLORS.greyDark,
      marginTop: pt(1),
    },
    educationDescription: {
      fontFamily: "Helvetica",
      fontSize: pt(FONT_SIZE.body),
      color: COLORS.body,
      lineHeight: LINE_HEIGHT,
      marginTop: pt(1),
    },
    skillsText: {
      fontFamily: "Helvetica",
      fontSize: pt(FONT_SIZE.body),
      color: COLORS.body,
      lineHeight: LINE_HEIGHT,
    },
    languagesRow: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    languageItem: {
      fontFamily: "Helvetica",
      fontSize: pt(FONT_SIZE.body),
      color: COLORS.body,
    },
    languageName: {
      fontFamily: "Helvetica-Bold",
    },
    languageSep: {
      marginHorizontal: pt(6),
      color: COLORS.greyLight,
    },
  });
}

// @react-pdf/renderer's line-breaker (@react-pdf/textkit) treats any text
// token immediately followed by a run of 2+ literal space characters as a
// hyphenation candidate — its check for "is this just whitespace, not a
// hyphenation point" only recognizes a *single* space (`nextSyllable !== '
// '`, compared verbatim), so a run of 2-3 spaces doesn't satisfy it. That
// makes multi-space separators like "   •   " susceptible to a spurious
// hyphen right before a line wrap, e.g. "Team Leadership   •-\nBudget
// Management" — reproduced and confirmed via @react-pdf/textkit's
// getNodes()/hyphenated logic, not a hyphenation-dictionary issue (a custom
// Font.registerHyphenationCallback does NOT fix this; the bug is in how
// this glue token width is classified, upstream of hyphenation entirely).
// Fix: keep exactly one real (breakable, plain " ") space per gap, and pad
// the rest with U+00A0 non-breaking spaces — same rendered width as a
// regular space, but NBSP isn't matched by the space-run regex that forms
// these tokens, so it never produces a multi-space run and never trips the
// check. CVPreview.tsx (plain HTML/CSS, a normal browser text layout, not
// this custom engine) has no such bug and intentionally keeps plain spaces.
const SKILLS_SEPARATOR = "\u00A0\u00A0 •\u00A0\u00A0 ";
const INLINE_SEPARATOR = "\u00A0 |\u00A0 ";
const LANGUAGE_SEPARATOR = "\u00A0 —\u00A0 ";

interface CVDocumentProps {
  data: CvData;
  /**
   * Server-resolved image source (e.g. a Buffer read from /public) to use
   * instead of `data.photoUrl`. The route handler passes this because a
   * "/photo.jpg" web path isn't a valid image source inside a Node PDF
   * render — see app/api/export-pdf/route.ts.
   */
  photoSrc?: string | Buffer;
  /** Uniform shrink factor for fonts/spacing/photo — see the file doc-comment above. Defaults to 1 (no shrink). */
  scale?: number;
}

export function CVDocument({ data, photoSrc, scale = 1 }: CVDocumentProps) {
  const resolvedPhoto = photoSrc ?? data.photoUrl;
  const styles = createStyles(scale);

  return (
    <Document title={`${data.name} — CV`} author={data.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {/* @react-pdf/renderer's Image (not next/image or <img>) — no alt prop exists. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {resolvedPhoto ? <Image src={resolvedPhoto} style={styles.photo} /> : null}
          <View style={styles.headerText}>
            <Text style={styles.name}>{data.name.toUpperCase()}</Text>
            {data.title ? <Text style={styles.title}>{data.title}</Text> : null}
            <Text style={styles.contact}>
              {[
                data.contact.email,
                data.contact.phone,
                data.contact.location,
                data.contact.address,
                data.contact.age !== undefined ? `${data.contact.age} years` : undefined,
                data.contact.website,
              ]
                .filter(Boolean)
                .join(INLINE_SEPARATOR)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {data.summary ? (
          <View style={[styles.section, styles.sectionFirst]} wrap={false}>
            <Text style={styles.sectionHeader}>PROFESSIONAL SUMMARY</Text>
            <Text style={styles.paragraph}>{data.summary}</Text>
          </View>
        ) : null}

        {data.experience.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>PROFESSIONAL EXPERIENCE</Text>
            {data.experience.map((entry, i) => (
              <View key={entry.id} style={i === 0 ? styles.entryFirst : styles.entry} wrap={false}>
                <Text style={styles.roleTitle}>{entry.title}</Text>
                <Text style={styles.companyLine}>
                  {[entry.company, entry.dates].filter(Boolean).join(INLINE_SEPARATOR)}
                </Text>
                {entry.bullets.map((bullet, bi) => (
                  <View key={bi} style={styles.bulletRow}>
                    <Text style={styles.bulletMarker}>{"•"}</Text>
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {data.education.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>EDUCATION</Text>
            {data.education.map((entry, i) => (
              <View key={entry.id} style={i === 0 ? styles.entryFirst : styles.entry} wrap={false}>
                <Text style={styles.degree}>{entry.degree}</Text>
                <Text style={styles.institutionLine}>
                  {[entry.school, entry.endDate].filter(Boolean).join(" — ")}
                  {entry.honors ? ` (${entry.honors})` : ""}
                </Text>
                {entry.description ? <Text style={styles.educationDescription}>{entry.description}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {data.skills.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionHeader}>SKILLS</Text>
            <Text style={styles.skillsText}>{data.skills.join(SKILLS_SEPARATOR)}</Text>
          </View>
        ) : null}

        {data.languages.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionHeader}>LANGUAGES</Text>
            <View style={styles.languagesRow}>
              {data.languages.map((lang, i) => (
                <Text key={lang.lang} style={styles.languageItem}>
                  <Text style={styles.languageName}>{lang.lang}</Text>
                  {` (${lang.level})`}
                  {i < data.languages.length - 1 ? <Text style={styles.languageSep}>{LANGUAGE_SEPARATOR}</Text> : null}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
