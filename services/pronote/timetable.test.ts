import { describe, expect, it, jest } from "@jest/globals";

// Coupe la chaîne native (mmkv) : api-client -> settings store, logger -> logs store.
jest.mock("@/services/pronote/api-client", () => ({
  PronoteApiClient: {},
}));
jest.mock("@/utils/logger/logger", () => ({
  error: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
}));

import { AttachmentType } from "@/services/shared/attachment";
import {
  matchContentForCourse,
  toLocalWallIso,
} from "./timetable";

describe("toLocalWallIso", () => {
  it("formate l'heure murale locale sans offset (pas d'UTC)", () => {
    // Constructeur local -> indépendant du TZ de la machine.
    expect(toLocalWallIso(new Date(2026, 8, 12, 8, 30, 5))).toBe(
      "2026-09-12T08:30:05"
    );
  });
});

describe("matchContentForCourse", () => {
  const resources: any[] = [
    {
      title: "Chapitre 3",
      description: "Exercices",
      category: 1,
      attachments: [
        {
          type: AttachmentType.FILE,
          name: "cours.pdf",
          url: "https://example/file",
          createdByAccount: "acc",
        },
      ],
    },
  ];

  it("rattache par heure murale + matière (insensible à la casse)", () => {
    const course: any = {
      from: new Date(2026, 8, 12, 8, 0, 0),
      subject: "Mathématiques",
    };
    const contents: any[] = [
      {
        lessonId: "rotating-id-session-2",
        lessonStart: new Date(2026, 8, 12, 8, 0, 0),
        subject: "MATHEMATIQUES",
        resources,
      },
    ];
    expect(matchContentForCourse(contents, course)).toBe(resources);
  });

  it("rejette un contenu décalé de 2h (ancien bug UTC vs mur)", () => {
    const course: any = {
      from: new Date(2026, 8, 12, 8, 0, 0),
      subject: "Mathématiques",
    };
    const contents: any[] = [
      {
        lessonId: "x",
        // 06:00 UTC = l'ancien lessonStart ".toISOString()" d'un cours de 08:00 Paris.
        lessonStart: new Date(2026, 8, 12, 6, 0, 0),
        subject: "MATHEMATIQUES",
        resources,
      },
    ];
    expect(matchContentForCourse(contents, course)).toBeNull();
  });

  it("rejette une matière différente à la même heure", () => {
    const course: any = {
      from: new Date(2026, 8, 12, 8, 0, 0),
      subject: "Français",
    };
    const contents: any[] = [
      {
        lessonId: "x",
        lessonStart: new Date(2026, 8, 12, 8, 0, 0),
        subject: "MATHEMATIQUES",
        resources,
      },
    ];
    expect(matchContentForCourse(contents, course)).toBeNull();
  });

  it("retourne null sans contenus", () => {
    const course: any = {
      from: new Date(2026, 8, 12, 8, 0, 0),
      subject: "Maths",
    };
    expect(matchContentForCourse([], course)).toBeNull();
    expect(matchContentForCourse(undefined, course)).toBeNull();
  });
});
