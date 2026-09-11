import { Attendance, ObservationType } from "@/services/shared/attendance";
import { CanteenMenu } from "@/services/shared/canteen";
import { Chat, Message, Recipient } from "@/services/shared/chat";
import {
  Evaluation,
  Period,
  PeriodGrades,
  Report,
  Subject,
} from "@/services/shared/grade";
import { Homework, ReturnFormat } from "@/services/shared/homework";
import { News } from "@/services/shared/news";
import {
  CourseDay,
  CourseStatus,
  CourseType,
} from "@/services/shared/timetable";

type LessonTemplate = {
  subject: string;
  teacher: string;
  room: string;
  color: string;
};

const LESSONS: LessonTemplate[] = [
  {
    subject: "Mathématiques",
    teacher: "Mme Lefèvre",
    room: "B 204",
    color: "#3568D4",
  },
  {
    subject: "Français",
    teacher: "M. Dubois",
    room: "A 112",
    color: "#D94B64",
  },
  {
    subject: "Histoire-Géographie",
    teacher: "Mme Bernard",
    room: "C 018",
    color: "#E29035",
  },
  {
    subject: "Anglais",
    teacher: "Mme Martin",
    room: "B 106",
    color: "#8E5AC7",
  },
  {
    subject: "Physique-Chimie",
    teacher: "M. Robert",
    room: "Labo 2",
    color: "#24A17A",
  },
  {
    subject: "Sciences de la vie et de la Terre",
    teacher: "Mme Moreau",
    room: "Labo 4",
    color: "#4A9B4F",
  },
  {
    subject: "Sciences économiques et sociales",
    teacher: "M. Petit",
    room: "C 202",
    color: "#B4772D",
  },
  {
    subject: "Éducation physique et sportive",
    teacher: "Mme Roux",
    room: "Gymnase",
    color: "#E05D34",
  },
];

const HOMEWORK_CONTENT = [
  [
    "Mathématiques",
    "<p>Faire les exercices 42 à 47 page 128. Détailler les calculs dans le cahier.</p>",
  ],
  [
    "Français",
    "<p>Lire les chapitres 6 et 7 de <em>Germinal</em> et préparer trois citations commentées.</p>",
  ],
  [
    "Histoire-Géographie",
    "<p>Réviser le chapitre sur la Révolution française et compléter la frise chronologique.</p>",
  ],
  [
    "Anglais",
    "<p>Apprendre le vocabulaire de la séquence « Living in London » et préparer l'expression orale.</p>",
  ],
  [
    "Physique-Chimie",
    "<p>Rédiger le compte rendu du TP sur la réfraction de la lumière.</p>",
  ],
  [
    "Sciences de la vie et de la Terre",
    "<p>Terminer le schéma légendé de la cellule et revoir la fiche méthode.</p>",
  ],
] as const;

const atTime = (day: Date, hours: number, minutes = 0): Date => {
  const result = new Date(day);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getDateRangeOfWeek = (weekNumber: number, year: number) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getWeekRange } = require("@/utils/services/periods");
    return getWeekRange(weekNumber, year);
  } catch {
    const janFirst = new Date(year, 0, 1);
    const daysOffset = (weekNumber - 1) * 7;
    const weekStart = new Date(janFirst.setDate(janFirst.getDate() + daysOffset));
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day <= 4 ? 1 : 8);
    const start = new Date(weekStart.setDate(diff));
    const end = addDays(start, 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
};

export function generateMockTimetable(
  accountId: string,
  weekNumber: number,
  referenceDate: Date
): CourseDay[] {
  const { start } = getDateRangeOfWeek(weekNumber, referenceDate.getFullYear());
  const slots = [
    [8, 0, 9, 0],
    [9, 10, 10, 10],
    [10, 25, 11, 25],
    [13, 30, 14, 30],
    [14, 40, 15, 40],
  ];

  return Array.from({ length: 5 }, (_, dayIndex) => {
    const date = addDays(start, dayIndex);
    const courses = slots.map(
      ([fromHour, fromMinute, toHour, toMinute], slotIndex) => {
        const lessonIndex =
          (dayIndex * 3 + slotIndex * 2 + weekNumber) % LESSONS.length;
        const lesson = LESSONS[lessonIndex];
        const from = atTime(date, fromHour, fromMinute);
        const to = atTime(date, toHour, toMinute);
        const isEvaluated = dayIndex === 1 && slotIndex === 1;
        const isEdited = dayIndex === 3 && slotIndex === 3;
        const isCanceled = dayIndex === 4 && slotIndex === 4;

        return {
          id: `mock-course-${referenceDate.getFullYear()}-${weekNumber}-${dayIndex}-${slotIndex}`,
          subject: lesson.subject,
          teacher: lesson.teacher,
          room: lesson.room,
          backgroundColor: lesson.color,
          group: slotIndex % 3 === 0 ? "Seconde 2" : undefined,
          additionalInfo: isEvaluated ? "Évaluation prévue" : undefined,
          status: isEvaluated
            ? CourseStatus.EVALUATED
            : isEdited
              ? CourseStatus.EDITED
              : isCanceled
                ? CourseStatus.CANCELED
                : undefined,
          type: CourseType.LESSON,
          from,
          to,
          createdByAccount: accountId,
        };
      }
    );

    return { date: atTime(date, 0), courses };
  });
}

export function generateMockHomeworks(
  accountId: string,
  weekNumber: number,
  year = new Date().getFullYear()
): Homework[] {
  const { start } = getDateRangeOfWeek(weekNumber, year);

  return Array.from({ length: 5 }, (_, dayIndex) => {
    const [subject, content] =
      HOMEWORK_CONTENT[(weekNumber + dayIndex) % HOMEWORK_CONTENT.length];
    const dueDate = atTime(addDays(start, dayIndex), 8);
    return {
      id: `mock-homework-${year}-${weekNumber}-${dayIndex}`,
      subject,
      content,
      dueDate,
      isDone: dayIndex === 0,
      returnFormat:
        dayIndex === 4 ? ReturnFormat.FILE_UPLOAD : ReturnFormat.PAPER,
      attachments: [],
      evaluation: dayIndex === 1 || dayIndex === 3,
      custom: false,
      progress: dayIndex === 2 ? 55 : undefined,
      createdByAccount: accountId,
    };
  });
}

export function getMockSchoolYear(referenceDate = new Date()): number {
  return referenceDate.getMonth() >= 7
    ? referenceDate.getFullYear()
    : referenceDate.getFullYear() - 1;
}

export function generateMockPeriods(
  accountId: string,
  referenceDate = new Date()
): Period[] {
  const year = getMockSchoolYear(referenceDate);
  return [
    {
      id: `mock-period-${year}-1`,
      name: "Trimestre 1",
      start: new Date(year, 8, 2),
      end: new Date(year, 11, 20, 23, 59),
      createdByAccount: accountId,
    },
    {
      id: `mock-period-${year}-2`,
      name: "Trimestre 2",
      start: new Date(year + 1, 0, 6),
      end: new Date(year + 1, 2, 28, 23, 59),
      createdByAccount: accountId,
    },
    {
      id: `mock-period-${year}-3`,
      name: "Trimestre 3",
      start: new Date(year + 1, 2, 31),
      end: new Date(year + 1, 6, 4, 23, 59),
      createdByAccount: accountId,
    },
  ];
}

const GRADE_SUBJECTS = [
  ["Mathématiques", 15.5, 13.2],
  ["Français", 14, 12.8],
  ["Histoire-Géographie", 16, 13.7],
  ["Anglais", 17.5, 14.1],
  ["Physique-Chimie", 13.5, 12.4],
  ["Sciences de la vie et de la Terre", 15, 13.5],
] as const;

export function generateMockGrades(
  accountId: string,
  period: Period
): PeriodGrades {
  const periodIndex = Number(period.name.slice(-1)) || 1;
  const subjects: Subject[] = GRADE_SUBJECTS.map(
    ([name, studentAverage, classAverage], subjectIndex) => {
      const subjectId = `mock-subject-${subjectIndex}`;
      const adjustedAverage = studentAverage - (periodIndex - 1) * 0.3;
      return {
        id: subjectId,
        name,
        studentAverage: { value: adjustedAverage, outOf: 20 },
        classAverage: { value: classAverage, outOf: 20 },
        maximum: { value: 19, outOf: 20 },
        minimum: { value: 7.5, outOf: 20 },
        outOf: { value: 20 },
        grades: [0, 1, 2].map(gradeIndex => ({
          id: `mock-grade-${periodIndex}-${subjectIndex}-${gradeIndex}`,
          subjectId,
          subjectName: name,
          description: [
            "Contrôle de connaissances",
            "Devoir maison",
            "Participation orale",
          ][gradeIndex],
          comment:
            gradeIndex === 0
              ? "Bon travail dans l'ensemble, soigne la rédaction."
              : gradeIndex === 1 && subjectIndex === 0
                ? "Résultats en progrès, poursuivre les efforts."
                : undefined,
          isBonus: subjectIndex === 4 && gradeIndex === 2,
          isOptional: subjectIndex === 1 && gradeIndex === 2,
          isOutOf20: subjectIndex === 5 && gradeIndex === 1,
          givenAt: addDays(
            period.start,
            14 + subjectIndex * 5 + gradeIndex * 18
          ),
          coefficient: gradeIndex === 0 ? 2 : 1,
          outOf: { value: subjectIndex === 5 && gradeIndex === 1 ? 10 : 20 },
          studentScore: {
            value:
              subjectIndex === 5 && gradeIndex === 1
                ? 8.5
                : Math.max(8, adjustedAverage + gradeIndex - 1),
            outOf: subjectIndex === 5 && gradeIndex === 1 ? 10 : 20,
          },
          averageScore: { value: classAverage, outOf: 20 },
          minScore: { value: 6.5, outOf: 20 },
          maxScore: { value: 19.5, outOf: 20 },
          createdByAccount: accountId,
        })),
      };
    }
  );

  return {
    studentOverall: { value: 15.2 - (periodIndex - 1) * 0.2, outOf: 20 },
    classAverage: { value: 13.3, outOf: 20 },
    rank: { value: 6, outOf: 7 },
    subjects,
    createdByAccount: accountId,
  };
}

export function generateMockNews(
  accountId: string,
  referenceDate = new Date()
): News[] {
  const items = [
    [
      "Réunion parents-professeurs",
      "La direction",
      "Vie de l'établissement",
      "<p>La réunion parents-professeurs aura lieu jeudi à partir de 17 h 30. Le planning des salles sera affiché dans le hall.</p>",
    ],
    [
      "Nouveautés au CDI",
      "Mme Garcia, professeure documentaliste",
      "CDI",
      "<p>Une sélection de romans contemporains et de bandes dessinées est disponible au CDI. Les élèves peuvent les emprunter pendant trois semaines.</p>",
    ],
    [
      "Inscription à l'association sportive",
      "Service de la vie scolaire",
      "Vie scolaire",
      "<p>Les inscriptions à l'association sportive sont ouvertes jusqu'à vendredi. Une autorisation parentale est nécessaire.</p>",
    ],
    [
      "Collecte solidaire",
      "Conseil de la vie lycéenne",
      "Projet citoyen",
      "<p>Le CVL organise une collecte de fournitures scolaires au profit d'une association locale.</p>",
    ],
  ] as const;

  return items.map(([title, author, category, content], index) => ({
    id: `mock-news-${index}`,
    title,
    author,
    category,
    content,
    createdAt: atTime(addDays(referenceDate, -index * 3), 10, 15),
    acknowledged: index > 1,
    question: index === 0,
    attachments: [],
    createdByAccount: accountId,
  }));
}

export function generateMockAttendance(
  accountId: string,
  referenceDate = new Date()
): Attendance {
  const year = getMockSchoolYear(referenceDate);
  return {
    createdByAccount: accountId,
    delays: [
      {
        id: `mock-delay-${year}`,
        givenAt: new Date(year, 9, 7, 8, 12),
        reason: "Retard du bus",
        justified: true,
        justification: "Motif pris en compte par la vie scolaire.",
        duration: 12,
        createdByAccount: accountId,
      },
    ],
    absences: [
      {
        id: `mock-absence-${year}`,
        from: new Date(year, 10, 18, 8),
        to: new Date(year, 10, 18, 12),
        reason: "Rendez-vous médical",
        timeMissed: 240,
        days: 1,
        justified: true,
        createdByAccount: accountId,
      },
    ],
    observations: [
      {
        id: `mock-observation-${year}`,
        givenAt: new Date(year, 9, 14, 11, 20),
        sectionName: "Travail et comportement",
        sectionType: ObservationType.Observation,
        subjectName: "Français",
        shouldParentsJustify: false,
        reason: "Travail non présenté au début du cours.",
      },
      {
        id: `mock-encouragement-${year}`,
        givenAt: new Date(year, 11, 2, 15, 30),
        sectionName: "Encouragement",
        sectionType: ObservationType.Encouragement,
        subjectName: "Histoire-Géographie",
        shouldParentsJustify: false,
        reason: "Exposé particulièrement clair et bien documenté.",
      },
    ],
    punishments: [
      {
        id: `mock-punishment-${year}`,
        givenAt: new Date(year + 1, 0, 16, 16),
        givenBy: "Mme Leroy, CPE",
        exclusion: false,
        duringLesson: false,
        nature: "Retenue",
        duration: 60,
        durationMinutes: 60,
        schedulable: true,
        homework: {
          text: "Rédiger une réflexion sur le respect du règlement intérieur.",
          documents: [],
        },
        reason: {
          text: "Usage du téléphone dans les couloirs.",
          circumstances:
            "Téléphone utilisé pendant un intercours malgré un premier rappel.",
          documents: [],
        },
      },
    ],
  };
}

export function generateMockChats(accountId: string): Chat[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    {
      id: "mock-chat-vie-scolaire",
      subject: "Sortie scolaire au musée",
      recipient: "Mme Leroy (Vie scolaire)",
      creator: "Mme Leroy",
      date: new Date(now - 2 * day),
      createdByAccount: accountId,
    },
    {
      id: "mock-chat-maths",
      subject: "Devoir de mathématiques",
      recipient: "Mme Lefèvre",
      creator: "Mme Lefèvre",
      date: new Date(now - 5 * day),
      createdByAccount: accountId,
    },
    {
      id: "mock-chat-eps",
      subject: "Certificat médical EPS",
      recipient: "M. Fontaine",
      creator: "Camille Martin",
      date: new Date(now - 9 * day),
      createdByAccount: accountId,
    },
  ];
}

export function generateMockChatRecipients(accountId: string): Recipient[] {
  void accountId;
  return [
    { id: "mock-recipient-lefevre", name: "Mme Lefèvre", class: "Mathématiques" },
    { id: "mock-recipient-dubois", name: "M. Dubois", class: "Français" },
    { id: "mock-recipient-leroy", name: "Mme Leroy", class: "Vie scolaire" },
    { id: "mock-recipient-fontaine", name: "M. Fontaine", class: "EPS" },
  ];
}

const MOCK_THREADS: Record<string, Array<[string, string, number, string]>> = {
  "mock-chat-vie-scolaire": [
    ["Mme Leroy", "Bonjour, la sortie au musée d'Orsay aura lieu vendredi. Pensez à l'autorisation signée !", 2, "09:12"],
    ["Camille Martin", "Bonjour, c'est noté, je la rapporte demain matin.", 2, "18:40"],
    ["Mme Leroy", "Parfait, merci !", 1, "08:05"],
  ],
  "mock-chat-maths": [
    ["Mme Lefèvre", "Le devoir sur les fonctions est reporté à jeudi.", 5, "17:20"],
    ["Camille Martin", "Merci pour l'info, on reverra le chapitre 4 d'ici là ?", 4, "19:02"],
  ],
  "mock-chat-eps": [
    ["Camille Martin", "Bonjour, voici mon certificat médical pour la dispense d'EPS.", 9, "10:15"],
  ],
};

export function generateMockChatMessages(
  accountId: string,
  chatId: string
): Message[] {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  void accountId;
  const thread = MOCK_THREADS[chatId] ?? [];
  return thread.map(([author, content, daysAgo, time], index) => {
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date(now - daysAgo * day);
    date.setHours(hours, minutes, 0, 0);
    return {
      id: `mock-message-${chatId}-${index}`,
      subject: "",
      content,
      author,
      date,
      attachments: [],
    };
  });
}

interface MockDish {
  name: string;
  allergens?: string[];
}

const MOCK_MENUS_DATA: Array<{
  entry: MockDish[];
  main: MockDish[];
  side: MockDish[];
  cheese: MockDish[];
  dessert: MockDish[];
  drink: MockDish[];
}> = [
  {
    entry: [
      { name: "Salade de tomates et mozzarella di bufala", allergens: ["Lait"] },
      { name: "Salade de lentilles corail au vinaigre de cidre" },
    ],
    main: [
      { name: "Filet de poulet rôti fermier au thym" },
      { name: "Steak végétal aux céréales et légumes du soleil", allergens: ["Gluten", "Soja"] },
    ],
    side: [
      { name: "Riz pilaf aux petits légumes" },
      { name: "Haricots verts extra-fins persillés" },
    ],
    cheese: [
      { name: "Brie de Meaux AOP", allergens: ["Lait"] },
      { name: "Yaourt nature bio local", allergens: ["Lait"] },
    ],
    dessert: [
      { name: "Tartelette aux pommes caramélisées", allergens: ["Gluten", "Œufs", "Lait"] },
      { name: "Fruit de saison bio (Pomme ou Poire)" },
    ],
    drink: [{ name: "Eau micro-filtrée fraîche" }],
  },
  {
    entry: [
      { name: "Velouté de potimarron et graines de courge", allergens: ["Lait"] },
      { name: "Betteraves rôties à l'huile de noisette", allergens: ["Fruits à coque"] },
    ],
    main: [
      { name: "Pavé de colin d'Alaska MSC sauce citronnée", allergens: ["Poisson", "Lait"] },
      { name: "Dahl de lentilles corail au lait de coco" },
    ],
    side: [
      { name: "Purée maison de pommes de terre au beurre", allergens: ["Lait"] },
      { name: "Poêlée de carottes au cumin" },
    ],
    cheese: [{ name: "Emmental français râpé ou portion", allergens: ["Lait"] }],
    dessert: [
      { name: "Compote de pommes et châtaignes sans sucre ajouté" },
      { name: "Mousse au chocolat noir maison", allergens: ["Œufs", "Lait"] },
    ],
    drink: [{ name: "Eau micro-filtrée fraîche" }],
  },
  {
    entry: [
      { name: "Taboulé libanais à la menthe fraîche", allergens: ["Gluten"] },
    ],
    main: [
      { name: "Lasagnes aux légumes d'été et parmesan", allergens: ["Gluten", "Lait", "Œufs"] },
      { name: "Rôti de dinde braisé au jus" },
    ],
    side: [
      { name: "Gratin de courgettes", allergens: ["Lait"] },
      { name: "Semoule semi-complète bio", allergens: ["Gluten"] },
    ],
    cheese: [{ name: "Fromage blanc bio au coulis de fruits rouges", allergens: ["Lait"] }],
    dessert: [
      { name: "Salade de fruits frais maison" },
      { name: "Cookie artisanal aux pépites de chocolat", allergens: ["Gluten", "Œufs", "Lait"] },
    ],
    drink: [{ name: "Eau micro-filtrée fraîche" }],
  },
  {
    entry: [
      { name: "Carottes râpées bio à la vinaigrette d'agrumes" },
      { name: "Feuilleté chèvre et miel chaud", allergens: ["Gluten", "Lait"] },
    ],
    main: [
      { name: "Sauté de bœuf mijoté à la provençale" },
      { name: "Omelette fermière bio aux herbes fraîches", allergens: ["Œufs"] },
    ],
    side: [
      { name: "Coquillettes au blé complet bio", allergens: ["Gluten"] },
      { name: "Brocolis vapeur et touche d'huile d'olive" },
    ],
    cheese: [
      { name: "Cantal jeune AOP", allergens: ["Lait"] },
      { name: "Petit suisse aux fruits", allergens: ["Lait"] },
    ],
    dessert: [
      { name: "Éclair au chocolat de notre boulanger", allergens: ["Gluten", "Œufs", "Lait"] },
      { name: "Banane équitable" },
    ],
    drink: [{ name: "Eau micro-filtrée fraîche" }],
  },
  {
    entry: [
      { name: "Concombre à la crème ciboulette", allergens: ["Lait"] },
      { name: "Salade piémontaise traditionnelle", allergens: ["Œufs", "Moutarde"] },
    ],
    main: [
      { name: "Pizza margherita cuite au four pierre", allergens: ["Gluten", "Lait"] },
      { name: "Filet de merlu rôti au basilic", allergens: ["Poisson"] },
    ],
    side: [
      { name: "Salade mesclun aux jeunes pousses" },
      { name: "Frites de patates douces au four" },
    ],
    cheese: [{ name: "Saint-Nectaire fermier", allergens: ["Lait"] }],
    dessert: [
      { name: "Crème glacée vanille artisanale", allergens: ["Lait"] },
      { name: "Orange pressée ou kiwi bio" },
    ],
    drink: [{ name: "Eau micro-filtrée fraîche" }],
  },
];

export function generateMockCanteenMenu(accountId: string, startDate: Date): CanteenMenu[] {  const monday = new Date(startDate);
  monday.setHours(0, 0, 0, 0);
  const weekday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - weekday);
  return MOCK_MENUS_DATA.map((dayData, index) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + index);
    return {
      date,
      createdByAccount: accountId,
      lunch: {
        entry: dayData.entry,
        main: dayData.main,
        side: dayData.side,
        cheese: dayData.cheese,
        dessert: dayData.dessert,
        drink: dayData.drink,
      },
      dinner: undefined,
    };
  });
}

const MOCK_EVALUATIONS: Array<{
  name: string;
  subject: string;
  teacher: string;
  coefficient: number;
  description: string;
  daysAfterPeriodStart: number;
  acquisitions: Array<[string, string, string, number, string, string]>;
}> = [
  {
    name: "Proportionnalité et pourcentages",
    subject: "Mathématiques",
    teacher: "Mme Lefèvre",
    coefficient: 2,
    description: "Évaluation de fin de séquence : tableaux de proportionnalité, pourcentages et échelles.",
    daysAfterPeriodStart: 42,
    acquisitions: [
      ["Chercher", "MS", "Maîtrise satisfaisante", 1, "Chercher", "D2 — Méthodes et outils"],
      ["Modéliser", "TBM", "Très bonne maîtrise", 1, "Modéliser", "D4 — Systèmes naturels"],
      ["Calculer", "MF", "Maîtrise fragile", 2, "Calculer", "D4 — Systèmes naturels"],
      ["Communiquer", "MS", "Maîtrise satisfaisante", 1, "Communiquer", "D1 — Langages"],
    ],
  },
  {
    name: "Lecture analytique : Germinal",
    subject: "Français",
    teacher: "M. Dubois",
    coefficient: 2,
    description: "Commentaire guidé d'un extrait du chapitre 6, registre pathétique et champ lexical de la mine.",
    daysAfterPeriodStart: 55,
    acquisitions: [
      ["Lire", "TBM", "Très bonne maîtrise", 2, "Lire", "D1 — Langages"],
      ["Écrire", "MS", "Maîtrise satisfaisante", 2, "Écrire", "D1 — Langages"],
      ["Dire", "MF", "Maîtrise fragile", 1, "Dire", "D1 — Langages"],
    ],
  },
  {
    name: "La Révolution française : 1789",
    subject: "Histoire-Géographie",
    teacher: "Mme Bernard",
    coefficient: 1,
    description: "Frise chronologique commentée et analyse d'une caricature d'époque.",
    daysAfterPeriodStart: 63,
    acquisitions: [
      ["Se repérer dans le temps", "MS", "Maîtrise satisfaisante", 1, "Repères", "D5 — Représentations du monde"],
      ["Analyser un document", "MI", "Maîtrise insuffisante", 2, "Analyser", "D2 — Méthodes et outils"],
    ],
  },
  {
    name: "Living in London — expression orale",
    subject: "Anglais",
    teacher: "Mme Martin",
    coefficient: 1,
    description: "Prise de parole en continu : présenter son quartier idéal à Londres, 2 minutes.",
    daysAfterPeriodStart: 70,
    acquisitions: [
      ["Parler en continu", "TBM", "Très bonne maîtrise", 2, "Parler", "D1 — Langages"],
      ["Réagir et dialoguer", "MS", "Maîtrise satisfaisante", 1, "Dialoguer", "D1 — Langages"],
    ],
  },
  {
    name: "TP : réfraction de la lumière",
    subject: "Physique-Chimie",
    teacher: "M. Robert",
    coefficient: 1,
    description: "Compte rendu de TP : protocole, mesures d'angles et tracé du rayon réfracté.",
    daysAfterPeriodStart: 77,
    acquisitions: [
      ["Pratiquer des démarches scientifiques", "MS", "Maîtrise satisfaisante", 2, "Démarches", "D4 — Systèmes naturels"],
      ["Utiliser des instruments", "MF", "Maîtrise fragile", 1, "Instruments", "D4 — Systèmes naturels"],
    ],
  },
  {
    name: "La cellule : schéma légendé",
    subject: "Sciences de la vie et de la Terre",
    teacher: "Mme Moreau",
    coefficient: 1,
    description: "Schéma légendé d'une cellule observée au microscope et restitution des fonctions.",
    daysAfterPeriodStart: 84,
    acquisitions: [
      ["Observer", "TBM", "Très bonne maîtrise", 1, "Observer", "D4 — Systèmes naturels"],
      ["Restituer des connaissances", "MS", "Maîtrise satisfaisante", 1, "Restituer", "D4 — Systèmes naturels"],
    ],
  },
];

export function generateMockEvaluations(
  accountId: string,
  period: Period
): Evaluation[] {
  return MOCK_EVALUATIONS.map((evaluation, index) => ({
    id: `mock-evaluation-${period.name.slice(-1)}-${index}`,
    name: evaluation.name,
    subject: evaluation.subject,
    teacher: evaluation.teacher,
    coefficient: evaluation.coefficient,
    description: evaluation.description,
    date: addDays(period.start, evaluation.daysAfterPeriodStart),
    paliers: ["MI", "MF", "MS", "TBM"],
    acquisitions: evaluation.acquisitions.map(
      ([name, abbreviation, level, coefficient, domain, pillar]) => ({
        name,
        abbreviation,
        level,
        coefficient,
        domain,
        pillar,
      })
    ),
    createdByAccount: accountId,
  }));
}

const MOCK_REPORT_SUBJECTS: Array<{
  name: string;
  color: string;
  student: number;
  classAverage: number;
  min: number;
  max: number;
  coefficient: number;
  teachers: string[];
  comments: string[];
}> = [
  {
    name: "Mathématiques",
    color: "#3568D4",
    student: 15.5,
    classAverage: 13.2,
    min: 7.5,
    max: 19,
    coefficient: 4,
    teachers: ["Mme Lefèvre"],
    comments: ["Très bon trimestre, travail sérieux et régulier."],
  },
  {
    name: "Français",
    color: "#D94B64",
    student: 14,
    classAverage: 12.8,
    min: 8,
    max: 18,
    coefficient: 4,
    teachers: ["M. Dubois"],
    comments: ["Bonne participation orale, poursuivre les efforts à l'écrit."],
  },
  {
    name: "Histoire-Géographie",
    color: "#E29035",
    student: 16,
    classAverage: 13.7,
    min: 9,
    max: 18.5,
    coefficient: 3,
    teachers: ["Mme Bernard"],
    comments: ["Excellent travail d'analyse, élève curieux et rigoureux."],
  },
  {
    name: "Anglais",
    color: "#8E5AC7",
    student: 17.5,
    classAverage: 14.1,
    min: 9.5,
    max: 19.5,
    coefficient: 3,
    teachers: ["Mme Martin"],
    comments: ["Niveau remarquable, accent travaillé avec soin."],
  },
  {
    name: "Physique-Chimie",
    color: "#24A17A",
    student: 13.5,
    classAverage: 12.4,
    min: 6.5,
    max: 18,
    coefficient: 3,
    teachers: ["M. Robert"],
    comments: ["Résultats corrects mais irréguliers, la rédaction doit progresser."],
  },
  {
    name: "Sciences de la vie et de la Terre",
    color: "#4A9B4F",
    student: 15,
    classAverage: 13.5,
    min: 8,
    max: 18,
    coefficient: 2,
    teachers: ["Mme Moreau"],
    comments: ["Bon trimestre, schémas soignés."],
  },
];

export function generateMockReport(
  accountId: string,
  period: Period
): Report | null {
  // Trimestre 3 : bulletin pas encore publié — teste l'état vide.
  if (period.name.endsWith("3")) {
    return null;
  }
  return {
    comments: [
      "Trimestre satisfaisant dans l'ensemble. Camille est un élève sérieux qui participe avec pertinence. Encouragements du conseil de classe.",
    ],
    subjects: MOCK_REPORT_SUBJECTS.map(subject => ({
      name: subject.name,
      color: subject.color,
      comments: subject.comments,
      classAverage: subject.classAverage,
      studentAverage: subject.student,
      minAverage: subject.min,
      maxAverage: subject.max,
      coefficient: subject.coefficient,
      teachers: subject.teachers,
    })),
    createdByAccount: accountId,
  };
}

export function generateMockTeachingStaff(accountId: string): Array<{
  name: string;
  subject: string;
  email: string;
}> {
  void accountId;
  return [
    ...LESSONS.map(lesson => ({
      name: lesson.teacher,
      subject: lesson.subject,
      email:
        lesson.teacher
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/^(mme|m)\.\s+/, "")
          .replace(/\s+/g, ".") + "@college-exemple.fr",
    })),
    {
      name: "Mme Leroy",
      subject: "Vie scolaire",
      email: "vie-scolaire@college-exemple.fr",
    },
    {
      name: "Mme Garcia",
      subject: "Documentation",
      email: "cdi@college-exemple.fr",
    },
  ];
}
