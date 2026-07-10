import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "@/lib/cv-data";
import { COLORS, FONT_SIZE, SPACING_MM, PAGE, PHOTO_SIZE_MM, DIVIDER_THICKNESS_PT, LINE_HEIGHT, mmToPt } from "@/lib/tokens";

const styles = StyleSheet.create({
  page: {
    paddingTop: mmToPt(PAGE.marginMm),
    paddingBottom: mmToPt(PAGE.marginMm),
    paddingLeft: mmToPt(PAGE.marginMm),
    paddingRight: mmToPt(PAGE.marginMm),
    fontFamily: "Helvetica",
    fontSize: FONT_SIZE.body,
    color: COLORS.body,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  photo: {
    width: mmToPt(PHOTO_SIZE_MM),
    height: mmToPt(PHOTO_SIZE_MM),
    objectFit: "cover",
  },
  headerText: {
    marginLeft: mmToPt(SPACING_MM.photoGap),
    flex: 1,
    justifyContent: "center",
  },
  name: {
    fontFamily: "Helvetica-Bold",
    fontSize: FONT_SIZE.name,
    color: COLORS.navy,
  },
  title: {
    fontFamily: "Helvetica",
    fontSize: FONT_SIZE.title,
    color: COLORS.amber,
    marginTop: 4,
  },
  contact: {
    fontFamily: "Helvetica",
    fontSize: FONT_SIZE.contact,
    color: COLORS.greyDark,
    marginTop: 4,
  },
  divider: {
    borderBottomWidth: DIVIDER_THICKNESS_PT,
    borderBottomColor: COLORS.amber,
    marginTop: mmToPt(SPACING_MM.dividerMarginTop),
    marginBottom: mmToPt(SPACING_MM.dividerMarginBottom),
  },
  section: {
    marginTop: mmToPt(SPACING_MM.sectionGapTop),
  },
  sectionFirst: {
    marginTop: 0,
  },
  sectionHeader: {
    fontFamily: "Helvetica-Bold",
    fontSize: FONT_SIZE.sectionHeader,
    color: COLORS.navy,
    marginBottom: mmToPt(SPACING_MM.sectionHeaderGapBottom),
  },
  paragraph: {
    fontFamily: "Helvetica",
    fontSize: FONT_SIZE.body,
    color: COLORS.body,
    lineHeight: LINE_HEIGHT,
  },
  entry: {
    marginTop: mmToPt(SPACING_MM.entryGapTop),
  },
  entryFirst: {
    marginTop: 0,
  },
  roleTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: FONT_SIZE.roleTitle,
    color: COLORS.navy,
  },
  companyLine: {
    fontFamily: "Helvetica-Oblique",
    fontSize: FONT_SIZE.companyLine,
    color: COLORS.amber,
    marginTop: 1,
  },
  bulletRow: {
    flexDirection: "row",
    marginTop: mmToPt(SPACING_MM.bulletGap),
    paddingLeft: mmToPt(4),
  },
  bulletMarker: {
    width: mmToPt(4),
    fontSize: FONT_SIZE.body,
    color: COLORS.body,
  },
  bulletText: {
    flex: 1,
    fontFamily: "Helvetica",
    fontSize: FONT_SIZE.body,
    color: COLORS.body,
    lineHeight: LINE_HEIGHT,
  },
  degree: {
    fontFamily: "Helvetica-Bold",
    fontSize: FONT_SIZE.degree,
    color: COLORS.navy,
  },
  institutionLine: {
    fontFamily: "Helvetica",
    fontSize: FONT_SIZE.body,
    color: COLORS.greyDark,
    marginTop: 1,
  },
  educationDescription: {
    fontFamily: "Helvetica",
    fontSize: FONT_SIZE.body,
    color: COLORS.body,
    lineHeight: LINE_HEIGHT,
    marginTop: 1,
  },
  skillsText: {
    fontFamily: "Helvetica",
    fontSize: FONT_SIZE.body,
    color: COLORS.body,
    lineHeight: LINE_HEIGHT,
  },
  languagesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  languageItem: {
    fontFamily: "Helvetica",
    fontSize: FONT_SIZE.body,
    color: COLORS.body,
  },
  languageName: {
    fontFamily: "Helvetica-Bold",
  },
  languageSep: {
    marginHorizontal: 6,
    color: COLORS.greyLight,
  },
});

const SKILLS_SEPARATOR = "   •   ";

interface CVDocumentProps {
  data: CvData;
  /**
   * Server-resolved image source (e.g. a Buffer read from /public) to use
   * instead of `data.photoUrl`. The route handler passes this because a
   * "/photo.jpg" web path isn't a valid image source inside a Node PDF
   * render — see app/api/export-pdf/route.ts.
   */
  photoSrc?: string | Buffer;
}

export function CVDocument({ data, photoSrc }: CVDocumentProps) {
  const resolvedPhoto = photoSrc ?? data.photoUrl;

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
              {[data.contact.email, data.contact.phone, data.contact.location, data.contact.website]
                .filter(Boolean)
                .join("  |  ")}
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
                  {[entry.company, entry.dates].filter(Boolean).join("  |  ")}
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
                  {i < data.languages.length - 1 ? (
                    <Text style={styles.languageSep}>{"  —  "}</Text>
                  ) : null}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
