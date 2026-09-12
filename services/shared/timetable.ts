import { Attachment } from "@/services/shared/attachment";
import { GenericInterface } from "@/services/shared/types";

export interface CourseDay {
  date: Date;
  courses: Course[];
}

export interface Course extends GenericInterface {
  subject: string;
  subjectId?: string | null;
  subjectGroups?: boolean;
  id: string;
  type: CourseType;
  from: Date;
  to: Date;
  additionalInfo?: string;
  room?: string;
  teacher?: string;
  teacherNames?: string[];
  classrooms?: string[];
  group?: string;
  groupNames?: string[];
  num?: number;
  normal?: boolean;
  detention?: boolean;
  outing?: boolean;
  isTest?: boolean;
  exempted?: boolean;
  virtualClassrooms?: string[];
  backgroundColor?: string;
  status?: CourseStatus;
  customStatus?: string;
  url?: string;
  resourceId?: string;
  /** Contenu et ressources du cours (cahier de textes). */
  content?: CourseResource[];
}

export interface CourseResource {
  title?: string;
  description?: string;
  category: number | string;
  attachments: Attachment[]
}

/** Contenu du cahier de textes rattaché à un créneau (ids Pronote tournants :
 *  le rattachement à un Course se fait par heure de début + matière). */
export interface WeekLessonContent {
  lessonId?: string;
  /** Début du créneau (heure murale établissement, même référentiel que Course.from). */
  lessonStart: Date | null;
  subject: string;
  resources: CourseResource[];
}

export enum CourseType {
  LESSON,
  ACTIVITY,
  DETENTION,
  VACATION
}

export enum CourseStatus {
  CANCELED,
  EDITED,
  ONLINE,
  EVALUATED
}