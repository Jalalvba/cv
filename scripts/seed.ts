/**
 * Standalone seed script — run via `pnpm run db:seed`.
 *
 * Upserts one ProfileDoc into `profile` and seven PositioningDoc entries
 * (3 English, 4 French — 2 of the French ones marked draftTranslation: true)
 * into `positionings`, keyed on `_id` via replaceOne(..., { upsert: true }).
 * Re-running this script is idempotent: it never duplicates documents or
 * bullets, it just overwrites each `_id` with the content below.
 *
 * Content is transcribed from the real reference CV
 * (template/CV_Jalal_Chafiq_Stellantis.pdf) — not placeholder text.
 */
import { MongoClient } from "mongodb";
import { profileDocSchema, positioningDocSchema } from "../lib/validation";
import type { ProfileDoc, PositioningDoc } from "../lib/cv-data";

const profile: ProfileDoc = {
  _id: "jalal_chafiq",
  personal: {
    name: "Jalal Chafiq",
    email: "chafiq.jalal@gmail.com",
    phone: "+212 674 664 173",
    location: "Casablanca, Morocco",
    website: "chafiqjalal.com",
    languages: [
      { lang: "Arabic", level: "native" },
      { lang: "French", level: "fluent" },
      { lang: "English", level: "fluent" },
    ],
  },
  education: [
    {
      id: "edu_phd",
      degree: "PhD, Mechanical Engineering (Composite Materials)",
      school: "Hassan II University of Casablanca",
      endDate: "2024",
      honors: "Highest Honors",
      description:
        "Doctoral research and coursework in mechanical engineering: electromagnetism, non-destructive testing (NDT), and composite materials — dynamic and static mechanical behavior of natural hybrid composites. Taught engineering students, alongside doctoral work, in materials science, electromagnetism, and automotive embedded systems diagnostics.",
      descriptionFr:
        "Recherche doctorale et formation en génie mécanique : électromagnétisme, contrôle non destructif (CND), et matériaux composites — comportement mécanique dynamique et statique des composites hybrides naturels. Enseignement, en parallèle du doctorat, auprès d'élèves ingénieurs : cours de matériaux, d'électromagnétisme, et de diagnostic des systèmes embarqués automobiles.",
      tags: ["engineering", "research"],
    },
    {
      id: "edu_ensem",
      degree: "State Engineer Degree, Mechanical Engineering",
      school: "ENSEM, Casablanca",
      endDate: "2014",
      tags: ["engineering"],
    },
    {
      id: "edu_prepa",
      degree: "Preparatory Classes for Engineering Schools (MP)",
      school: "Lycee Alkhansa, Casablanca",
      endDate: "2011",
      tags: ["prepa"],
    },
    {
      id: "edu_bac",
      degree: "Baccalaureate, Mathematical Sciences",
      school: "Lycee Jaber Ibn Hayan, Casablanca",
      endDate: "2009",
      honors: "High Honors",
      tags: ["secondary"],
    },
  ],
  experience: [
    {
      id: "exp_avis",
      title: "Technical Manager",
      company: "AVIS Maroc, Casablanca",
      location: "Casablanca",
      startDate: "2025-07",
      endDate: null,
      bullets: [
        {
          id: "avis_b1",
          text: "Manage technical case resolution end-to-end, from incident report to vehicle return, including quality control and case closure.",
          textFr:
            "Pilotage de bout en bout des dossiers techniques : de la déclaration de l'incident jusqu'à la restitution du véhicule, incluant intervention, contrôle qualité et clôture du dossier.",
          tags: ["ops", "customer_care", "quality"],
        },
        {
          id: "avis_b2",
          text: "Oversee bodywork repair operations in coordination with insurers and automotive experts on insurance-related cases.",
          textFr:
            "Gestion de l'atelier carrosserie en coordination avec les assureurs et experts automobiles pour les dossiers sinistres.",
          tags: ["insurance", "ops"],
        },
        {
          id: "avis_b3",
          text: "Supervise a network of internal technical service points and lead recruitment, training, and performance management for a multidisciplinary team.",
          // Consolidates two distinct bullets from the source French material (see DOCS.md §7 note on this bullet) — concatenated verbatim, not merged/rephrased.
          textFr:
            "Supervision du réseau de plateformes techniques internes : suivi quotidien, planification des ressources humaines et matérielles, anticipation des besoins. Management des équipes techniques : recrutement, formation, animation et suivi de la performance.",
          tags: ["training", "leadership", "fleet"],
        },
        {
          id: "avis_b4",
          text: "Manage the annual technical budget and ensure compliance with Health, Safety, Quality, and Environment (QSE) standards.",
          // Consolidates two distinct bullets from the source French material (see DOCS.md §7 note on this bullet) — concatenated verbatim, not merged/rephrased.
          textFr:
            "Élaboration, suivi et optimisation du budget technique annuel, avec un objectif de réduction des coûts et d'amélioration de l'efficacité opérationnelle. Garantie du respect des normes Sécurité, Qualité et Environnement (QSE) sur l'ensemble des activités techniques.",
          tags: ["budget", "compliance", "quality"],
        },
        {
          id: "avis_b5",
          text: "Apply hands-on automotive diagnostic expertise — CAN bus protocol analysis, UDS diagnostic services, OEM technical bulletin interpretation — to internal fleet troubleshooting and tooling development.",
          textFr:
            "Application d'une expertise pratique en diagnostic automobile — analyse du protocole bus CAN, services de diagnostic UDS, interprétation de bulletins techniques constructeur — au dépannage et au développement d'outils internes de la flotte.",
          tags: ["diagnostics", "can_bus", "uds", "technical_trainer", "oem"],
        },
        {
          id: "avis_b6",
          text: "Led a genuine multi-brand upskilling effort across the fleet's diverse vehicle brands: technical support on complex cases, training on diagnostic tooling use, SAV process compliance, and planning of external training delivered by outside providers (OFPPT).",
          textFr:
            "À AVIS, un véritable volet de montée en compétence a été réalisé pour les marques multimarques de notre flotte : support technique sur les cas complexes, formation à l'utilisation de l'outillage de diagnostic, respect des processus SAV, et planification de formations externes réalisées par des prestataires externes (OFPPT).",
          tags: ["training", "multi_brand", "diagnostics", "technical_trainer"],
        },
      ],
    },
    {
      id: "exp_auto_hall",
      title: "After-Sales Manager",
      company: "Groupe Auto Hall, Casablanca",
      location: "Casablanca",
      startDate: "2024-10",
      endDate: "2025-07",
      bullets: [
        {
          id: "autohall_b1",
          text: "Managed an authorized RMA Insurance repair center: handled the full insurance claim cycle on the Omega claims platform, from repair estimate to completion certificate and reimbursement request.",
          textFr:
            "Garage agréé RMA Assurance : gestion complète des dossiers sinistres sur système Omega, de l'établissement du devis à l'obtention de la fiche de fin de travaux et la demande de remboursement.",
          tags: ["insurance", "ops"],
        },
        {
          id: "autohall_b2",
          text: "Oversaw after-sales operations across two workshops and a spare parts store, accountable for profitability and customer satisfaction.",
          textFr:
            "Supervision de deux ateliers et d'un magasin de pièces de rechange, avec responsabilité pleine sur la rentabilité et la satisfaction client.",
          tags: ["ops", "customer_care", "fleet"],
        },
        {
          id: "autohall_b3",
          text: "Tracked KPIs and implemented continuous improvement initiatives.",
          textFr: "Pilotage par indicateurs de performance (KPI) et mise en œuvre de leviers d'amélioration continue.",
          tags: ["kpi", "continuous_improvement"],
        },
        {
          id: "autohall_b4",
          text: "Coordinated with manufacturers to enforce brand standards and service quality requirements.",
          textFr:
            "Coordination avec les constructeurs pour garantir la conformité aux standards de marque et la qualité de service.",
          tags: ["compliance", "oem"],
        },
        {
          id: "autohall_b5",
          text: "Delivered ongoing team training in coordination with subsidiaries and the regional technical department, and provided technical support to teams on complex cases.",
          textFr:
            "Formation continue des équipes réalisée en coordination avec les filiales et le service technique régional, et apport d'un support technique aux équipes sur les cas complexes.",
          tags: ["training", "technical_support", "technical_trainer"],
        },
      ],
    },
    {
      id: "exp_sad_vw",
      title: "Volkswagen After-Sales Manager",
      company: "Super Auto Distribution, Rabat",
      location: "Rabat",
      startDate: "2023-01",
      endDate: "2024-10",
      bullets: [
        {
          id: "sadvw_b1",
          text: "Led execution of the Volkswagen group's regional after-sales strategy, acting as the operational link between the dealer network and OEM standards.",
          textFr: "Déploiement de la stratégie après-vente du groupe Volkswagen sur le périmètre régional.",
          tags: ["strategy", "oem", "dealer_network"],
        },
        {
          id: "sadvw_b2",
          text: "Managed bodywork repair operations in coordination with insurers and automotive experts.",
          textFr: "Gestion de l'atelier carrosserie en coordination avec les assureurs et experts automobiles.",
          tags: ["insurance", "ops"],
        },
        {
          id: "sadvw_b3",
          text: "Ensured compliance with manufacturer standards and quality processes.",
          textFr: "Garantie de conformité aux standards constructeur et aux processus qualité.",
          tags: ["compliance", "quality", "oem"],
        },
        {
          id: "sadvw_b4",
          text: "Tracked performance indicators and implemented corrective action plans.",
          textFr: "Suivi des indicateurs de performance et mise en œuvre de mesures correctives.",
          tags: ["kpi", "continuous_improvement"],
        },
        {
          id: "sadvw_b5",
          text: "Guided technicians on interpreting OEM technical bulletins, correct use of repair manuals, and warranty procedure compliance. Supported technicians through the manufacturer's certification path, from base technician level to master level. Planned and enrolled staff in manufacturer-delivered training programs.",
          textFr:
            "Accompagnement des techniciens dans l'interprétation des bulletins techniques constructeur, la bonne utilisation des manuels de réparation et le respect des procédures de garantie. Accompagnement des techniciens dans leur parcours de certification, du niveau technicien de base jusqu'au niveau master. Planification et inscription des agents aux formations dispensées par le constructeur.",
          tags: ["training", "certification", "oem", "pedagogy", "technical_trainer"],
        },
      ],
    },
    {
      id: "exp_dekra",
      title: "Vehicle Technical Inspection Center Manager",
      company: "DEKRA Automotive Maroc, Casablanca",
      location: "Casablanca",
      startDate: "2015-02",
      endDate: "2022-12",
      bullets: [
        {
          id: "dekra_b1",
          text: "Directed a vehicle technical inspection center, ensuring compliance with national regulatory standards and quality procedures.",
          textFr:
            "Direction et gestion globale d'un centre, garantissant le respect des normes réglementaires et des procédures de conformité.",
          tags: ["compliance", "quality"],
        },
        {
          id: "dekra_b2",
          text: "Developed the center's commercial activity across a defined territory through strategic action plans.",
          textFr:
            "Développement de l'activité commerciale du centre sur une zone géographique déterminée, via des plans d'action stratégiques.",
          tags: ["business_development", "strategy"],
        },
        {
          id: "dekra_b3",
          text: "Managed relationships with an external partner ecosystem over a 7-year period.",
          textFr: "Gestion de la relation avec un écosystème de partenaires externes sur 7 ans.",
          tags: ["partner_network", "fleet"],
        },
        {
          id: "dekra_b4",
          text: "Trained vehicle inspection agents on regulatory compliance and quality management system procedures for control operations. Coached agents toward passing certification exams for their professional aptitude credential, and supported them through internal/external audits and government administration inspections.",
          textFr:
            "Formation des agents visiteurs des centres de contrôle technique selon la réglementation en vigueur, et sur le respect du système de management qualité au bon déroulement des opérations de contrôle. Accompagnement des agents visiteurs pour la réussite de leurs formations en vue de l'obtention du certificat d'aptitude professionnelle. Accompagnement des agents visiteurs pour la réussite des audits internes et externes, ainsi que des inspections de l'administration.",
          tags: ["training", "pedagogy", "compliance", "certification", "technical_trainer"],
        },
      ],
    },
  ],
};

const positionings: PositioningDoc[] = [
  {
    _id: "after_sales_manager_en",
    roleGroup: "after_sales_manager",
    targetTitle: "After-Sales Manager",
    summary:
      "Automotive engineer (State Engineer, ENSEM Casablanca, 2014) with 10 years of experience across after-sales operations, technical service management, and dealer/partner network coordination. Proven track record managing complex customer cases end-to-end, including coordination with insurers and independent experts on insurance-referred claims. Experienced in KPI-driven performance management, OEM standards compliance (Volkswagen), and cross-functional collaboration between technical, quality, and after-sales teams.",
    skillsOrder: [
      "Customer Case Management & Resolution",
      "After-Sales Operations",
      "Dealer & Partner Network Coordination",
      "Insurance Claims Handling (RMA / Omega)",
      "OEM Standards Compliance",
      "KPI & Performance Management",
      "Team Leadership",
      "Budget Management",
      "QSE Compliance",
    ],
    bulletSelection: {
      exp_avis: ["avis_b1", "avis_b2", "avis_b3", "avis_b4"],
      exp_auto_hall: ["autohall_b1", "autohall_b2", "autohall_b3", "autohall_b4"],
      exp_sad_vw: ["sadvw_b1", "sadvw_b2", "sadvw_b3", "sadvw_b4"],
      // exp_dekra intentionally omitted — falls back to all of DEKRA's bullets by default.
    },
    format: "visual",
    language: "en",
  },
  {
    // Reconciled here to match the version seeded directly to MongoDB in an earlier
    // one-off task (bypassing this script) — content dictated verbatim by the user,
    // not translated/authored by an assistant. Now extended with the diagnostics
    // bullet/skills and PhD summary sentence — see avis_b5 above.
    _id: "technical_trainer_en",
    roleGroup: "technical_trainer",
    targetTitle: "Technical Trainer — Team Development & Dealer Network Coordination",
    summary:
      "State Engineer (ENSEM, 2014) with 10 years of automotive technical experience, including team training and development alongside direct coordination with a manufacturer (Volkswagen) on OEM standards and quality process compliance. Experience acting as the operational link between a dealer network and manufacturer requirements, with a consistent practice of transferring technical know-how to field teams. Complementary doctoral training in electromagnetism, non-destructive testing, and composite materials, bringing deep technical rigor to training delivery and knowledge transfer.",
    skillsOrder: [
      "Technical Training & Team Development",
      "OEM Standards Coordination",
      "Technician Certification Coaching",
      "Regulatory & Quality Compliance Training",
      "Automotive Diagnostics (CAN, UDS)",
      "OEM Technical Bulletin Interpretation",
      "Performance Management",
    ],
    bulletSelection: {
      // Every role explicit — no role omitted, so assemble()'s fallback-to-all-bullets
      // never triggers for this positioning. exp_dekra used to be omitted here (falling
      // back to all 3 of DEKRA's bullets, including dekra_b1/dekra_b2 which are about
      // center management and commercial development — not training, and not a fit for
      // a Technical Trainer CV). Now it resolves to only dekra_b4, the training-specific
      // bullet added alongside this fix.
      exp_avis: ["avis_b3", "avis_b5", "avis_b6"],
      exp_auto_hall: ["autohall_b4", "autohall_b5"],
      exp_sad_vw: ["sadvw_b1", "sadvw_b3", "sadvw_b5"],
      exp_dekra: ["dekra_b4"],
    },
    format: "ats",
    language: "en",
  },
  {
    _id: "fleet_management_en",
    roleGroup: "fleet_management",
    targetTitle: "Fleet & After-Sales Operations Manager",
    summary:
      "Automotive engineer (State Engineer, ENSEM Casablanca, 2014) with 10 years managing vehicle fleets, workshop networks, and after-sales operations across OEM and multi-brand environments. Skilled in coordinating maintenance and repair cycles with insurers and technical experts, tracking fleet and workshop KPIs, and ensuring OEM and regulatory compliance across every vehicle touchpoint.",
    skillsOrder: [
      "Fleet & Workshop Operations",
      "Insurance Claims Handling (RMA / Omega)",
      "Dealer & Partner Network Coordination",
      "OEM Standards Compliance",
      "KPI & Performance Management",
      "QSE Compliance",
    ],
    bulletSelection: {
      exp_avis: ["avis_b2", "avis_b1"],
      exp_auto_hall: ["autohall_b2", "autohall_b1", "autohall_b3"],
      // exp_sad_vw intentionally omitted — falls back to all of SAD/VW's bullets by default.
      exp_dekra: ["dekra_b3", "dekra_b1"],
    },
    format: "visual",
    language: "en",
  },
  {
    _id: "after_sales_manager_fr",
    roleGroup: "after_sales_manager",
    targetTitle: "Responsable Technique — Gestion de centre & pilotage SAV automobile",
    summary:
      "Ingénieur d'État (ENSEM, 2014) avec 10 ans d'expérience dans le pilotage de centres et de réseaux SAV automobile — supervision opérationnelle, gestion de la qualité des réparations, coordination avec un écosystème de partenaires, et pilotage par indicateurs de performance. Expérience directe de garage agréé RMA Assurance (Groupe Auto Hall) : gestion complète de dossiers sinistres sur système Omega, de l'expertise à la validation de la réparation. Recherche une évolution vers la gestion de centre à forte dimension partenariale et orientée expérience client.",
    skillsOrder: [
      "Gestion de centre",
      "Pilotage SAV automobile",
      "Gestion carrosserie en lien avec assureurs/experts",
      "Gestion de sinistres RMA (système Omega)",
      "Pilotage par KPI",
      "Management d'équipe",
      "Gestion de la qualité (QSE)",
      "Gestion budgétaire",
    ],
    // Structure copied exactly from "after_sales_manager_en" — same underlying content, French positioning.
    bulletSelection: {
      exp_avis: ["avis_b1", "avis_b2", "avis_b3", "avis_b4"],
      exp_auto_hall: ["autohall_b1", "autohall_b2", "autohall_b3", "autohall_b4"],
      exp_sad_vw: ["sadvw_b1", "sadvw_b2", "sadvw_b3", "sadvw_b4"],
      // exp_dekra intentionally omitted — falls back to all of DEKRA's bullets by default.
    },
    format: "visual",
    language: "fr",
  },
  {
    // Reconciled here to match the version seeded directly to MongoDB in an earlier
    // one-off task (bypassing this script) — content dictated verbatim by the user
    // in both languages, not machine-translated, hence no draftTranslation flag (the
    // prior generic version of this document did carry one; this one never did). Now
    // extended with the diagnostics bullet/skills and PhD summary sentence — see avis_b5 above.
    _id: "technical_trainer_fr",
    roleGroup: "technical_trainer",
    targetTitle: "Formateur Technique — Développement des compétences & coordination réseau concessionnaires",
    summary:
      "Ingénieur d'État (ENSEM, 2014) avec 10 ans d'expérience technique automobile, incluant la formation et le développement d'équipes techniques ainsi que la coordination directe avec des constructeurs (Volkswagen) pour l'application des standards OEM et la conformité aux processus qualité. Expérience de liaison opérationnelle entre réseau de distribution et exigences constructeur, avec une pratique constante de transmission du savoir-faire technique aux équipes terrain. Formation doctorale complémentaire en électromagnétisme, contrôle non destructif et matériaux composites, apportant une rigueur technique approfondie à la pédagogie et à la transmission de savoir-faire.",
    skillsOrder: [
      "Formation technique & développement d'équipe",
      "Coordination avec constructeurs (standards OEM)",
      "Accompagnement à la certification technicien",
      "Formation réglementaire & conformité qualité",
      "Diagnostic automobile (CAN, UDS)",
      "Interprétation de bulletins techniques constructeur",
      "Management de la performance",
    ],
    bulletSelection: {
      // Every role explicit — no role omitted, so assemble()'s fallback-to-all-bullets
      // never triggers for this positioning. exp_dekra used to be omitted here (falling
      // back to all 3 of DEKRA's bullets, including dekra_b1/dekra_b2 which are about
      // center management and commercial development — not training, and not a fit for
      // a Technical Trainer CV). Now it resolves to only dekra_b4, the training-specific
      // bullet added alongside this fix.
      exp_avis: ["avis_b3", "avis_b5", "avis_b6"],
      exp_auto_hall: ["autohall_b4", "autohall_b5"],
      exp_sad_vw: ["sadvw_b1", "sadvw_b3", "sadvw_b5"],
      exp_dekra: ["dekra_b4"],
    },
    format: "ats",
    language: "fr",
  },
  {
    // Draft machine translation — not yet human-reviewed. See draftTranslation flag and DOCS.md §7.2.
    _id: "fleet_management_fr",
    roleGroup: "fleet_management",
    targetTitle: "Responsable Gestion de Flotte & Opérations Après-Vente",
    summary:
      "Ingénieur automobile (Ingénieur d'État, ENSEM Casablanca, 2014) avec 10 ans d'expérience dans la gestion de flottes de véhicules, de réseaux d'ateliers et d'opérations après-vente dans des environnements constructeur et multimarques. Compétent dans la coordination des cycles de maintenance et de réparation avec les assureurs et experts techniques, le suivi des indicateurs de performance (KPI) de flotte et d'atelier, et la garantie de conformité constructeur et réglementaire à chaque point de contact véhicule.",
    skillsOrder: [
      "Gestion de flotte & d'atelier",
      "Gestion de sinistres (RMA / Omega)",
      "Coordination réseau concessionnaires & partenaires",
      "Conformité aux standards constructeur",
      "Pilotage par KPI & gestion de la performance",
      "Conformité QSE",
    ],
    // Structure copied exactly from "fleet_management_en" — same underlying content, French positioning.
    bulletSelection: {
      exp_avis: ["avis_b2", "avis_b1"],
      exp_auto_hall: ["autohall_b2", "autohall_b1", "autohall_b3"],
      // exp_sad_vw intentionally omitted — falls back to all of SAD/VW's bullets by default.
      exp_dekra: ["dekra_b3", "dekra_b1"],
    },
    format: "visual",
    language: "fr",
    draftTranslation: true,
  },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI. Copy .env.example to .env.local and fill in your MongoDB Atlas connection string.",
    );
  }

  const validatedProfile = profileDocSchema.parse(profile);
  const validatedPositionings = positionings.map((p) => positioningDocSchema.parse(p));

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("cv");

    await db
      .collection<ProfileDoc>("profile")
      .replaceOne({ _id: validatedProfile._id }, validatedProfile, { upsert: true });
    console.log(`Upserted profile document "${validatedProfile._id}"`);

    for (const positioning of validatedPositionings) {
      await db
        .collection<PositioningDoc>("positionings")
        .replaceOne({ _id: positioning._id }, positioning, { upsert: true });
      console.log(`Upserted positioning document "${positioning._id}"`);
    }

    // Remove any positioning document whose _id is no longer defined above — e.g. the
    // pre-rename "after_sales_manager" / "technical_trainer" / "fleet_management" _ids,
    // superseded by "..._en" once the {roleGroup}_{language} scheme was introduced.
    const currentIds = validatedPositionings.map((p) => p._id);
    const { deletedCount } = await db
      .collection<PositioningDoc>("positionings")
      .deleteMany({ _id: { $nin: currentIds } });
    if (deletedCount > 0) {
      console.log(`Removed ${deletedCount} stale positioning document(s) no longer defined in this script`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
